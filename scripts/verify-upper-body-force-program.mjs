import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const plan = JSON.parse(read('../src/coach/data/acceleratorPrograms.json'))['upper-body-force']
assert.equal(plan.length, 12)
const plain = (text) => text.replace(/\*\*/g, '').replace(/\[(.*?)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim()
for (const [index, session] of plan.entries()) {
  const suffix = String(index + 1).padStart(2, '0')
  const source = read(`../workout_plan/upper_body_force_generation/classes/class_${suffix}.md`)
  const workload = JSON.parse(read(`../workout_plan/upper_body_force_generation/workload_class_${suffix}.json`))
  assert.equal(session.n, index + 1)
  assert.deepEqual(session.minutes, workload.summary.estimated_prescribed_work_minutes)
  const rows = source.split('\n').filter((line) => /^\| [1-6] \|/.test(line)).map((line) => line.split('|').slice(1, -1).map(plain))
  assert.equal(rows.length, 14)
  for (const [rowIndex, exercise] of session.exercises.entries()) {
    const [, name, dose, instruction] = rows[rowIndex]
    assert.equal(exercise.name, name)
    assert.equal(exercise.dose, dose)
    assert.equal(exercise.instruction, instruction, `Class ${session.n} ${exercise.id}: full instructions and replacements retained`)
  }
  for (const [phase, count] of [['E', 6], ['S', 2], ['P', 6]]) {
    assert.equal(session.exercises.filter(({ id }) => id.startsWith(phase)).length, count)
    assert.ok(session.phaseNotes[phase].length > 0)
  }
  assert.ok(session.quality.includes('Quality marker,'))
  assert.ok(session.preparation.includes('existing predetermined Access & Prepare 1'))
  assert.ok(session.setup && session.delivery && session.progression)
  assert.ok(session.equipment.includes('Bench'), 'All classes retain a bench-supported strength row')
  assert.equal(session.exercises.filter(({ preparation }) => preparation).length, 6)
  assert.ok(session.exercises.filter(({ id }) => id.startsWith('P')).every(({ preparation }) => preparation.includes('separate from working sets')))
  assert.equal(workload.actual_observations, null, 'Integration does not record athlete completion')
}
assert.ok(plan[0].setup.includes('two-hand Band Speed Chest Press from a pause instead of E1'))
assert.ok(plan[0].phaseNotes.P.some((text) => text.includes('37 repetitions')))
assert.ok(plan[4].exercises[4].rest.includes('0 / 15 / 0 s'))
assert.equal(plan[6].exercises.find(({ id }) => id === 'P1').dose, '2 × 5 per arm')
assert.ok(plan[6].exercises.find(({ id }) => id === 'P1').preparation.includes('per arm'))
assert.ok(plan[8].equipment.includes('Loose battle rope'))
assert.ok(!plan[8].equipment.includes('Box / step'), 'A projection step is not an equipment box')
console.log('Verified Upper Body Force Generation: all 12 classes, 168 unchanged exercise rows, timing, phase guidance, per-arm preparation, replacements and equipment.')
