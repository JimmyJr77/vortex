import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const plain = text => text.replace(/\*\*/g, '').replace(/\[(.*?)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim()

export function validateFullBodyForceClass(record, markdown) {
  const n = record.class_number
  const s = record.session
  assert.equal(s.n, n)
  assert.equal(record.stage, Math.floor((n - 1) / 3) + 1)
  assert.equal(record.actual_observations, null)
  assert.equal(record.summary.actual_workload, null)
  assert.equal(record.summary.complete_session_minutes, null)
  assert.equal(record.summary.access_prepare_1_workload, null)
  assert.equal(s.exercises.length, 14)
  assert.equal(record.entries.length, 14)
  assert.deepEqual(s.counts, { explosive: 6, resilience: 2, primary: 6 })
  assert.deepEqual([...markdown.matchAll(/^## (\d)\./gm)].map(m => m[1]), ['1', '2', '3', '4'])
  const rows = markdown.split('\n').filter(line => /^\| [ESP]\d \|/.test(line)).map(line => line.split('|').slice(1,-1).map(plain))
  assert.equal(rows.length, 14)
  for (const [i, exercise] of s.exercises.entries()) {
    const e = record.entries[i]
    assert.equal(exercise.id, e.id)
    assert.equal(rows[i].length, 4)
    assert.equal(rows[i][0], e.id)
    assert.equal(rows[i][1], e.name)
    assert.equal(rows[i][2], e.dose)
    assert.equal(exercise.name, e.name)
    assert.equal(exercise.dose, e.dose)
    assert.equal(exercise.prescription, e.dose)
    assert.equal(exercise.instruction, e.coaching)
    assert.ok(rows[i][3].includes(plain(e.coaching)))
    assert.ok(rows[i][3].includes(plain(e.rest)))
    assert.equal(exercise.rest, e.rest)
    assert.deepEqual(exercise.equipment, e.equipment)
    assert.equal(exercise.preparation, e.preparation?.text ?? null)
    assert.ok(e.sets > 0 && e.reps > 0)
  }
  for (const phase of ['E','P']) {
    const es = record.entries.filter(e => e.phase === phase)
    for (const [program, count] of [['upper-body-force',2],['lower-body-force',2],['rotation-upper',1],['rotation-lower',1]]) assert.equal(es.filter(e => e.sourceProgramId === program).length, count, `Class ${n} ${phase}: ${program}`)
  }
  const support = record.entries.filter(e => e.phase === 'S')
  assert.deepEqual(support.map(e => e.sourceProgramId).sort(), ['lower-body-force','upper-body-force'])
  assert.equal(s.exercises.filter(e => e.preparation).length, 6)
  assert.equal(s.connections.length, 3)
  for (const [i, pair] of s.connections.entries()) {
    assert.deepEqual(pair.slots, [`E${i * 2 + 1}`,`E${i * 2 + 2}`])
    for (const id of pair.slots) assert.ok(pair.cue.includes(s.exercises.find(e => e.id === id).name), `Class ${n}: connection ${id} names the actual selected exercise`)
  }
  for (const field of ['effort','delivery','preparation','setup','quality','explosiveNotes','progression']) assert.ok(s[field]?.trim(), `${n}: complete ${field}`)
  for (const phase of ['E','S','P']) assert.ok(s.phaseNotes[phase].length)
  assert.ok(s.preparation.includes('existing predetermined Access & Prepare 1'))
  assert.ok(s.delivery.includes('after Access & Prepare 1'))
  assert.deepEqual(s.minutes, record.summary.estimated_post_prepare_minutes)
  return s
}

export function buildFullBodyForce(rootURL = new URL('../../workout_plan/', import.meta.url)) {
  const base = new URL('full_body_force_generation/', rootURL)
  const state = JSON.parse(readFileSync(new URL('progress.json', base), 'utf8'))
  assert.equal(state.last_finalized_class, 36, 'All 36 classes must be saved before collection integration')
  assert.equal(state.next_class, null)
  return Array.from({length:36}, (_, index) => {
    const suffix = String(index + 1).padStart(2,'0')
    const record = JSON.parse(readFileSync(new URL(`workload_class_${suffix}.json`,base),'utf8'))
    const markdown = readFileSync(new URL(`classes/class_${suffix}.md`,base),'utf8')
    return validateFullBodyForceClass(record, markdown)
  })
}
