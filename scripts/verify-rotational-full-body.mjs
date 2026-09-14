import { readFileSync, readdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const root = new URL('../workout_plan/rotational_force_full_body/', import.meta.url)
const data = JSON.parse(readFileSync(new URL('../src/coach/data/acceleratorPrograms.json', import.meta.url), 'utf8'))
const plan = JSON.parse(readFileSync(new URL('sequence.json', root), 'utf8'))
const sessions = data['rotation-full-body']
const signature = e => `${e.sourceProgram}:${e.sourceClass}:${e.sourceExerciseId}`
const dose = value => value.split(';')[0].split('. ')[0]
const reps = e => {
  const [sets, count] = e.dose.match(/^(\d+) × (\d+)/).slice(1).map(Number)
  return sets * count * (/Calf Raise/.test(e.name) || e.name === 'Landmine Rotation' ? 1 : 2)
}

test('all 36 classes integrate both regions in every phase through explicit mechanical connections', () => {
  assert.equal(plan.version, 2)
  assert.equal(plan.weeks, 36)
  assert.equal(plan.classesPerWeek, 1)
  assert.equal(sessions.length, 36)
  assert.deepEqual(sessions.map(s => s.n), Array.from({ length: 36 }, (_, i) => i + 1))
  for (const s of sessions) {
    assert.equal(s.exercises.length, 14)
    assert.equal(s.connections.length, 3)
    assert.ok(s.title.startsWith('Full body ·'))
    assert.ok(s.quality && s.delivery && s.preparation && s.extension && s.setup)
    for (const [phase, expected] of [['E', 3], ['S', 1], ['P', 3]]) {
      for (const program of ['rotation-upper', 'rotation-lower']) assert.equal(s.exercises.filter(e => e.id[0] === phase && e.sourceProgram === program).length, expected, `Class ${s.n} ${phase} ${program}`)
    }
    for (const [i, pair] of s.connections.entries()) {
      assert.deepEqual(pair.slots, [`E${i * 2 + 1}`, `E${i * 2 + 2}`])
      assert.deepEqual(pair.slots.map(id => s.exercises.find(e => e.id === id).sourceProgram), ['rotation-lower', 'rotation-upper'])
      assert.ok(pair.cue.trim() && pair.title.trim())
      for (const id of pair.slots) assert.ok(s.exercises.find(e => e.id === id).instruction.includes(pair.cue))
    }
  }
  assert.match(sessions[0].connections[0].cue, /support foot.*hip turn.*hands project/)
  assert.match(sessions[0].exercises[0].name, /hip pivot/)
  assert.match(sessions[0].exercises[1].name, /Scoop Toss/)
  assert.match(sessions[0].connections[1].cue, /support base.*thigh.*throwing hand/)
  assert.match(sessions[0].exercises[4].instruction, /E3's full kick/)
})

test('24 reworked lessons preserve all source exercise selections and working doses', () => {
  const integrated = sessions.filter(s => s.classRole === 'integration')
  assert.equal(integrated.length, 24)
  for (let stage = 1; stage <= 12; stage++) {
    const lessons = integrated.filter(s => s.stage === stage)
    assert.equal(lessons.length, 2)
    for (const program of ['rotation-upper', 'rotation-lower']) {
      const selected = lessons.flatMap(s => s.exercises).filter(e => e.sourceProgram === program)
      assert.deepEqual(selected.map(e => e.sourceExerciseId).sort(), data[program][stage - 1].exercises.map(e => e.id).sort(), `Stage ${stage} covers every source slot exactly once`)
    }
  }
  for (const s of sessions) for (const e of s.exercises) {
    const original = data[e.sourceProgram][e.sourceClass - 1].exercises.find(source => source.id === e.sourceExerciseId)
    assert.equal(e.sourceName, original.name)
    assert.equal(dose(e.dose), dose(original.dose))
    assert.ok(e.instruction && e.rest && e.prescription && e.equipment.length)
    if (e.id[0] === 'P') assert.match(e.preparation, /One easy set of/)
  }
})

test('12 application days build on both integrated lessons with specific development purposes', () => {
  const added = sessions.filter(s => s.classRole === 'application')
  assert.deepEqual(added.map(s => s.n), Array.from({ length: 12 }, (_, i) => (i + 1) * 3))
  for (const day of added) {
    const prior = new Set(sessions.filter(s => s.n < day.n).flatMap(s => s.exercises).map(signature))
    assert.ok(day.exercises.every(e => prior.has(signature(e))))
    assert.ok(day.extension.length > 170)
    assert.equal(day.effort, day.extension)
    if (day.n === 36) continue // Explicitly matched review of Week 3.
    for (const lesson of sessions.slice(day.n - 3, day.n - 1)) {
      const introduced = new Set(lesson.exercises.filter(e => e.id[0] === 'E').map(signature))
      assert.ok(day.exercises.some(e => e.id[0] === 'E' && introduced.has(signature(e))), `Application ${day.n} draws explosive work from both lessons`)
      assert.notDeepEqual(day.exercises.map(signature), lesson.exercises.map(signature))
    }
  }
  assert.match(sessions[23].extension, /propulsion, acceptance and recovery/)
  assert.match(sessions[29].extension, /cue errors separately from movement errors/)
})

test('consolidation, linked-landing counts and the matched final review remain valid', () => {
  for (const s of sessions) {
    assert.equal(s.exercises.filter(e => e.id[0] === 'E' && e.sourceProgram === 'rotation-upper').reduce((sum, e) => sum + reps(e), 0), s.workload.upperFastActions)
    assert.equal(s.exercises.filter(e => e.id[0] === 'E' && e.sourceProgram === 'rotation-lower').reduce((sum, e) => sum + reps(e), 0), s.workload.lowerAttempts)
    assert.equal(s.exercises.filter(e => e.id[0] === 'P').reduce((sum, e) => sum + reps(e), 0), s.workload.primaryWorkingReps)
  }
  for (const s of sessions.slice(15, 18)) assert.ok(s.exercises.filter(e => e.id[0] === 'P').every(e => e.dose.startsWith('1 ×')))
  assert.equal(sessions[17].workload.upperFastActions + sessions[17].workload.lowerAttempts, 24)
  assert.equal(sessions[17].workload.ballReleases, 4)
  assert.equal(sessions[17].workload.plannedLandings, 0)
  assert.equal(sessions[18].workload.plannedLandings + sessions[19].workload.plannedLandings, 12)
  assert.deepEqual(sessions[35].exercises, sessions[2].exercises)
  assert.match(sessions[35].quality, /Compare with Week 3 only when/)
})

test('36 complete class documents and the overview describe the integrated curriculum', () => {
  assert.equal(readdirSync(new URL('classes/', root)).filter(file => /^class_\d+\.md$/.test(file)).length, 36)
  const readme = readFileSync(new URL('README.md', root), 'utf8')
  assert.match(readme, /24 integrated classes/)
  assert.match(readme, /12 additional application days/)
  assert.doesNotMatch(readme, /24 existing \+|Lower body · Class|Upper body · Class/)
  for (const s of sessions) {
    const md = readFileSync(new URL(`classes/class_${String(s.n).padStart(2, '0')}.md`, root), 'utf8')
    assert.ok(md.includes(s.extension))
    for (const pair of s.connections) assert.ok(md.includes(pair.cue))
    assert.equal((md.match(/^\| [ESP]\d+ \|/gm) ?? []).length, 14)
  }
})
