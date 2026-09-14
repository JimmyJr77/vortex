import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const sourceRoot = new URL('../workout_plan/lower_body_force_generation/', import.meta.url)
const plan = JSON.parse(read('../src/coach/data/acceleratorPrograms.json'))['lower-body-force']
const plain = (text) => text.replace(/\*\*/g, '').replace(/\[(.*?)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim()
const unique = (items) => [...new Set(items)]
const phases = [['E', 'explosive', 6], ['S', 'resilience', 2], ['P', 'primary', 6]]
const doseFor = ({ sets, reps, unit, sides }) => `${sets} × ${reps}${unit === 'cycles' ? ' cycles' : ''}${sides === 2 ? ' per leg' : ''}`

assert.ok(Array.isArray(plan), 'The Athleticism Accelerator collection includes lower-body-force')
assert.equal(plan.length, 12, 'Exactly twelve weekly classes, without an extra class')
assert.deepEqual(readdirSync(new URL('classes/', sourceRoot)).filter((name) => /^class_\d+\.md$/.test(name)).sort(),
  Array.from({ length: 12 }, (_, index) => `class_${String(index + 1).padStart(2, '0')}.md`), 'All twelve source classes and no extra source class')
let exerciseCount = 0
let unilateralPreparationCount = 0
for (const [index, session] of plan.entries()) {
  const n = index + 1
  const suffix = String(n).padStart(2, '0')
  const source = readFileSync(new URL(`classes/class_${suffix}.md`, sourceRoot), 'utf8')
  const workload = JSON.parse(readFileSync(new URL(`workload_class_${suffix}.json`, sourceRoot), 'utf8'))
  const context = `Week ${n}`
  assert.equal(session.n, n, `${context}: ordered class number`)
  assert.equal(workload.class_number, n)
  assert.equal(workload.week, n)
  assert.equal(session.title, `Week ${n} — ${workload.title}`)
  assert.equal(session.effort, workload.effort, `${context}: targeted effort retained`)
  assert.equal(session.exercises.length, 14)
  assert.deepEqual(session.counts, { explosive: 6, resilience: 2, primary: 6 })
  assert.deepEqual(session.minutes, workload.summary.estimated_post_prepare_minutes)
  assert.equal(workload.summary.complete_session_minutes, null, `${context}: no invented total preparation/booking time`)
  assert.equal(workload.summary.access_prepare_1_workload, null, `${context}: existing preparation workload remains unknown`)
  assert.equal(workload.summary.actual_workload, null, `${context}: no prescribed work recorded as performed`)
  assert.equal(workload.actual_observations, null, `${context}: no invented athlete response`)

  const headings = [...source.matchAll(/^## (\d+)\. (.+)$/gm)]
  assert.deepEqual(headings.map((match) => match[1]), ['1', '2', '3', '4'])
  const sections = Object.fromEntries(headings.map((match, sectionIndex) => [match[1], source.slice(match.index + match[0].length, headings[sectionIndex + 1]?.index ?? source.length)]))
  assert.equal(session.preparation, plain(sections['1']), `${context}: complete existing preparation reference retained`)
  assert.ok(session.preparation.includes('existing predetermined Access & Prepare 1'))
  const entries = phases.flatMap(([phase, key, count], phaseIndex) => {
    assert.equal(workload[key].length, count)
    assert.equal(session.exercises.filter(({ id }) => id.startsWith(phase)).length, count)
    assert.deepEqual(session.phaseNotes[phase], workload.phase_notes[phase], `${context}: complete ${phase} guidance retained`)
    assert.ok(session.phaseNotes[phase].length)
    const rows = sections[String(phaseIndex + 2)].split('\n').filter((line) => /^\|\s*[1-6]\s*\|/.test(line))
      .map((line) => line.split('|').slice(1, -1).map(plain))
    assert.equal(rows.length, count)
    return workload[key].map((entry, slotIndex) => ({ entry, row: rows[slotIndex] }))
  })
  for (const [slotIndex, exercise] of session.exercises.entries()) {
    const { entry, row } = entries[slotIndex]
    const slot = `${context} ${entry.slot}`
    assert.equal(row.length, 4, `${slot}: complete four-column source row`)
    assert.equal(exercise.id, entry.slot)
    assert.equal(exercise.name, row[1], `${slot}: unchanged source name`)
    assert.equal(exercise.name, entry.name, `${slot}: ledger name matches`)
    assert.equal(exercise.dose, row[2], `${slot}: unchanged complete dose`)
    assert.equal(exercise.dose, doseFor(entry), `${slot}: ledger sets, reps, cycles and laterality match`)
    assert.equal(exercise.prescription, exercise.dose, `${slot}: summary dose is not truncated`)
    assert.equal(exercise.instruction, row[3], `${slot}: full instructions, recovery and replacement retained`)
    assert.ok(exercise.instruction.includes('Use instead:'), `${slot}: replacement remains visible`)
    assert.equal(exercise.rest, entry.rest_text, `${slot}: recovery is not truncated`)
    assert.deepEqual(exercise.equipment, entry.equipment, `${slot}: exact equipment declaration retained`)
    assert.equal(exercise.preparation, entry.preparation_text ?? null)
    if (entry.slot.startsWith('P')) {
      const prep = workload.primary_preparation.find(({ slot: prepSlot }) => prepSlot === entry.slot)
      assert.ok(prep && exercise.preparation, `${slot}: preparation record and coach text present`)
      assert.equal(prep.sides, entry.sides)
      assert.equal(prep.unit, entry.unit)
      assert.ok(exercise.preparation.includes(prep.reps_by_set.map((reps) => `1 × ${reps}`).join(' then ')), `${slot}: every preparation set retained`)
      assert.equal(prep.task_units, prep.reps_by_set.reduce((total, reps) => total + reps, 0) * prep.sides)
      if (entry.sides === 2) {
        unilateralPreparationCount += 1
        assert.ok(exercise.preparation.includes('per leg') && exercise.preparation.includes('30 s between legs'), `${slot}: per-leg preparation and recovery retained`)
      }
      if (entry.unit === 'cycles') assert.ok(exercise.preparation.includes('cycles'), `${slot}: complete-cycle preparation retained`)
    }
    exerciseCount += 1
  }
  assert.equal(session.exercises.filter(({ preparation }) => preparation).length, 6)
  assert.deepEqual(session.equipment, unique(entries.flatMap(({ entry }) => entry.equipment)).filter((item) => item !== 'Bodyweight'))
  for (const [field, sourceField] of [['quality', 'quality_marker'], ['explosiveNotes', 'brief'], ['setup', 'setup'], ['delivery', 'delivery'], ['progression', 'progression']]) {
    assert.equal(session[field], workload[sourceField], `${context}: complete ${field} guidance retained`)
    assert.ok(session[field].trim())
  }
  assert.ok(session.delivery.includes('after Access & Prepare 1'), `${context}: timing boundary visible`)
  assert.ok(session.delivery.includes('One coached focus class per week for twelve weeks'), `${context}: weekly cadence visible`)
}
assert.equal(exerciseCount, 168)
assert.ok(unilateralPreparationCount > 0, 'The full sequence preserves per-leg strength preparation')
console.log(`Verified Lower Body Force Generation: 12 weekly classes, ${exerciseCount} unchanged exercise rows, exact 6/2/6 counts, complete recovery and preparation, equipment, timing, weekly cadence and unknown actual workload.`)
