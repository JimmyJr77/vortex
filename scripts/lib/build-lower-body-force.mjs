import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const plain = (value = '') => value.replace(/\*\*/g, '').replace(/\[(.*?)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim()
const unique = (items) => [...new Set(items)]
const doseFor = ({ sets, reps, unit, sides }) => `${sets} × ${reps}${unit === 'cycles' ? ' cycles' : ''}${sides === 2 ? ' per leg' : ''}`
const phases = [['E', 'explosive', 6], ['S', 'resilience', 2], ['P', 'primary', 6]]

// Preserve the coach's complete markdown prescription. The checked workload
// record supplies recovery, equipment, preparation and guidance without guessing
// from names (a step, for example, is not necessarily a piece of equipment).
export function enrichLowerBodyForceSession(session, markdown, parts, source) {
  const suffix = String(session.n).padStart(2, '0')
  const workload = JSON.parse(readFileSync(new URL(`workload_class_${suffix}.json`, source), 'utf8'))
  const context = `Lower Body Force Generation class ${session.n}`
  assert.equal(workload.class_number, session.n, `${context}: workload class number`)
  assert.equal(workload.week, session.n, `${context}: one class per week`)
  assert.equal(workload.actual_observations, null, `${context}: prescriptions do not establish athlete completion`)
  assert.equal(workload.summary.actual_workload, null, `${context}: actual workload remains unknown`)
  assert.equal(workload.summary.complete_session_minutes, null, `${context}: existing preparation duration remains unknown`)
  assert.ok(parts['1']?.includes('existing predetermined Access & Prepare 1'), `${context}: preserve the existing preparation reference`)
  assert.equal(session.exercises.length, 14, `${context}: exactly fourteen exercise rows`)

  const entries = phases.flatMap(([phase, key, count], phaseIndex) => {
    assert.equal(workload[key].length, count, `${context}: ${key} count`)
    const rows = (parts[String(phaseIndex + 2)] ?? '').split('\n')
      .filter((line) => /^\|\s*[1-6]\s*\|/.test(line))
      .map((line) => line.split('|').slice(1, -1).map(plain))
    assert.equal(rows.length, count, `${context}: ${phase} markdown rows`)
    assert.ok(workload.phase_notes[phase]?.length, `${context}: ${phase} phase guidance`)
    return workload[key].map((entry, index) => {
      assert.equal(entry.slot, `${phase}${index + 1}`, `${context}: ordered workload slots`)
      assert.equal(rows[index].length, 4, `${context} ${entry.slot}: complete four-column source row`)
      assert.equal(rows[index][1], entry.name, `${context} ${entry.slot}: markdown and ledger names agree`)
      assert.equal(rows[index][2], doseFor(entry), `${context} ${entry.slot}: markdown and ledger doses agree`)
      assert.ok(entry.rest_text && entry.equipment?.length, `${context} ${entry.slot}: recovery and equipment specified`)
      if (phase === 'P') assert.ok(entry.preparation_text, `${context} ${entry.slot}: load preparation specified`)
      return { entry, row: rows[index] }
    })
  })

  const exercises = session.exercises.map((exercise, index) => {
    const { entry, row } = entries[index]
    assert.equal(exercise.id, entry.slot, `${context}: parsed slots match ledger order`)
    assert.equal(exercise.name, row[1], `${context} ${entry.slot}: full exercise name retained`)
    assert.equal(exercise.dose, row[2], `${context} ${entry.slot}: full dose retained`)
    assert.equal(exercise.instruction, row[3], `${context} ${entry.slot}: complete instruction and replacement retained`)
    return { ...exercise, rest: entry.rest_text, preparation: entry.preparation_text ?? null, equipment: [...entry.equipment] }
  })
  const minutes = workload.summary.estimated_post_prepare_minutes
  assert.ok(Array.isArray(minutes) && minutes.length === 2 && minutes.every(Number.isFinite) && minutes[0] > 0 && minutes[1] >= minutes[0], `${context}: valid post-preparation time range`)
  for (const field of ['quality_marker', 'brief', 'setup', 'delivery', 'progression']) {
    assert.ok(typeof workload[field] === 'string' && workload[field].trim(), `${context}: ${field} guidance`)
  }
  assert.ok(markdown.includes(workload.quality_marker), `${context}: quality guidance matches source`)
  return { ...session,
    title: workload.title,
    exercises,
    equipment: unique(exercises.flatMap(({ equipment }) => equipment)).filter((item) => item !== 'Bodyweight'),
    minutes: [...minutes],
    quality: workload.quality_marker,
    phaseNotes: Object.fromEntries(phases.map(([phase]) => [phase, [...workload.phase_notes[phase]]])),
    setup: workload.setup,
    delivery: workload.delivery,
    progression: workload.progression,
    explosiveNotes: workload.brief,
  }
}
