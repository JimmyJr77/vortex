import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const tracks = {
  'upper-body-force': 'upper_body_force_generation',
  'lower-body-force': 'lower_body_force_generation',
}
const phases = [['E', 'explosive', 6], ['S', 'resilience', 2], ['P', 'primary', 6]]
const plain = (text = '') => text.replace(/\*\*/g, '').replace(/\[(.*?)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim()
const sum = (values) => values.reduce((total, value) => total + value, 0)
const clone = (value) => structuredClone(value)
const sha256 = (text) => createHash('sha256').update(text).digest('hex')

function sections(markdown) {
  const result = {}
  const headings = [...markdown.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)]
  headings.forEach((heading, index) => {
    result[heading[1]] = markdown.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? markdown.length)
  })
  return result
}

function markdownRows(parts) {
  return phases.flatMap(([phase, , expected], phaseIndex) => {
    const rows = (parts[String(phaseIndex + 2)] ?? '').split('\n')
      .filter((line) => /^\|\s*(?:[ESP])?[1-6]\s*\|/.test(line))
      .map((line, index) => {
        const cells = line.split('|').slice(1, -1).map(plain)
        assert.equal(cells.length, 4, `${phase}${index + 1}: preserve the complete four-column source row`)
        return { id: `${phase}${index + 1}`, name: cells[1], dose: cells[2], instruction: cells[3], markdown: line }
      })
    assert.equal(rows.length, expected, `${phase}: source row count`)
    return rows
  })
}

// Upper workload ledgers do not contain equipment arrays. These categories are
// extracted from the prescribed task, not its replacement. The complete source
// cue and delivery conditions remain available; availability is never asserted.
function upperEquipment(name, cue) {
  const equipment = []
  if (/slam/i.test(name)) equipment.push('Slam ball')
  else if (/medicine ball/i.test(name)) equipment.push('Medicine ball')
  if (/dumbbell|floor press|one-arm row/i.test(name)) equipment.push('Dumbbells')
  if (/landmine/i.test(name)) equipment.push('Landmine')
  if (/band|pallof/i.test(name)) equipment.push('Bands')
  if (/attachment|overhead anchor/i.test(cue)) equipment.push('Rated band attachment')
  if (/battle-rope/i.test(name)) equipment.push('Loose battle rope')
  if (/pull-up/i.test(name)) equipment.push('Pull-up bar', 'Box / step')
  if (/plyo push-up/i.test(name)) equipment.push('Bench or box')
  else if (/bench/i.test(name) || /bench|hand\/knee supported/i.test(cue)) equipment.push('Bench')
  if (/wall power push-off/i.test(name)) equipment.push('Wall support')
  return [...new Set(equipment.length ? equipment : ['Bodyweight'])]
}

export function taskUnits(exercise) {
  return exercise.sets * exercise.reps * exercise.sides
}

export function normalizedDose(exercise) {
  const suffix = exercise.unit === 'cycles' ? ' cycles' : ''
  return `${exercise.sets} × ${exercise.reps}${suffix}${exercise.sides > 1 ? ` per ${exercise.sideLabel ?? 'side'}` : ''}`
}

// Includes active repetitions, the prescribed between-rep gaps, side change
// within each round and rest between complete rounds. Excludes transitions and
// load preparation, which must be budgeted exactly once by the combined plan.
export function workingSeconds(exercise) {
  for (const field of ['sets', 'reps', 'sides', 'activeSeconds', 'resetSeconds', 'sideRestSeconds', 'setRestSeconds']) {
    assert.ok(Number.isFinite(exercise[field]) && exercise[field] >= 0, `${exercise.sourceKey ?? exercise.name}: missing ${field}`)
  }
  const gaps = exercise.resetPatternSeconds
    ? (assert.equal(exercise.resetPatternSeconds.length, Math.max(0, exercise.reps - 1), `${exercise.name}: reset pattern length`), sum(exercise.resetPatternSeconds))
    : Math.max(0, exercise.reps - 1) * exercise.resetSeconds
  return exercise.sets * (exercise.sides * (exercise.reps * exercise.activeSeconds + gaps)
    + (exercise.sides - 1) * exercise.sideRestSeconds)
    + (exercise.sets - 1) * exercise.setRestSeconds
}

export function preparationSeconds(preparation) {
  if (!preparation) return 0
  return sum(preparation.repsBySet) * preparation.sides * preparation.activeSeconds
    + preparation.repsBySet.length * (preparation.sides - 1) * preparation.sideRestSeconds
    + Math.max(0, preparation.repsBySet.length - 1) * preparation.setRestSeconds
    + preparation.beforeWorkingSeconds
}

export function eventQuantities(exercise) {
  return Object.fromEntries(Object.entries(exercise.eventsPerRep).map(([event, quantity]) => [event, quantity * taskUnits(exercise)]))
}

export const doseFor = normalizedDose
export const workSeconds = workingSeconds

function upperEvents(entry, phase) {
  if (phase === 'S') return { light_reps: 1 }
  if (phase === 'P') return { strength_reps: 1 }
  const kind = entry.kind
  const events = { [kind]: 1 }
  if (kind.startsWith('throw_')) Object.assign(events, { throws: 1, [kind === 'throw_bilateral' ? 'bilateral_throws' : 'unilateral_throws']: 1 })
  if (kind === 'hand_landing_bilateral') Object.assign(events, { bilateral_hand_landing_events: 1, individual_hand_contacts: 2 })
  if (entry.catch) events.catches = 1
  if (entry.steps_per_rep) events.movement_steps = entry.steps_per_rep
  return events
}

// Class 1 predates per-row numeric timing. Rest and tempos below are recovered
// from its Markdown/audit. Rapid-motion duration is explicitly an estimate;
// matching later executions support, but do not retroactively prescribe, it.
const firstUpperTiming = {
  E1: [3, 20, 90, 0], E2: [3, 3, 90, 0], E3: [5, 10, 0, 0],
  E4: [3, 20, 0, 0], E5: [3, 2, 0, 0], E6: [3, 20, 0, 60],
  S1: [6, 0, 0, 0], S2: [5, 0, 0, 0],
  P1: [4, 0, 150, 0], P2: [4, 0, 120, 60], P3: [4, 0, 0, 0],
  P4: [4, 0, 0, 0], P5: [4, 0, 0, 0], P6: [4, 0, 0, 0],
}
const firstUpperKinds = {
  bilateral_throw: 'throw_bilateral', unilateral_throw: 'throw_unilateral',
  bilateral_rapid_pull: 'rapid_pull_bilateral', bilateral_hand_landing: 'hand_landing_bilateral',
  light_bilateral_strength: 'light_bilateral', bilateral_primary_strength: 'bilateral_strength',
  unilateral_primary_strength: 'unilateral_strength',
}
// Exact same-execution tracking keys from the later upper-body source ledgers;
// these are local continuity keys, not newly claimed canonical exercise IDs.
const firstUpperKeys = { P1: 'floor_press', P2: 'one_arm_row', P3: 'push_up', P4: 'rear_row', P5: 'triceps', P6: 'curl' }

function legacyUpperEntry(entry, row) {
  const [activeSeconds, resetSeconds, setRestSeconds, sideRestSeconds] = firstUpperTiming[entry.slot]
  return {
    name: entry.exercise, key: firstUpperKeys[entry.slot] ?? entry.exercise,
    sets: entry.sets, reps: entry.reps_per_set_per_execution_side, sides: entry.execution_sides,
    kind: firstUpperKinds[entry.type], active_seconds: activeSeconds, reset_seconds: resetSeconds,
    rest: setRestSeconds, side_rest: sideRestSeconds,
    // The original row is the authoritative job/cue; do not manufacture a split.
    job: null, cue: row.instruction, replacement: null,
    identity: null, novelty: null,
  }
}

function transitionSeconds(slot) {
  if (slot.startsWith('E')) return 90
  if (slot === 'S1') return 45
  if (slot === 'S2') return 60
  const index = Number(slot.slice(1))
  return index === 6 ? 0 : index <= 3 ? 120 : 90
}

function preparationFor(entry, record, row, upper, firstUpper) {
  if (!record) return null
  const sides = record.sides ?? record.execution_sides
  assert.equal(sides, entry.sides, `${row.id}: preparation remains on this same lift and sides`)
  const preparation = {
    sourceSlot: row.id, sourceName: row.name, repsBySet: [...record.reps_by_set], sides,
    unit: record.unit ?? 'reps', sideLabel: upper ? 'arm' : 'leg',
    activeSeconds: record.active_seconds_per_rep ?? entry.active_seconds,
    sourceActiveSeconds: record.active_seconds_per_rep ?? (upper && !firstUpper ? 3 : null),
    sideRestSeconds: 30, setRestSeconds: 60,
    beforeWorkingSeconds: Number(row.id.slice(1)) <= 2 ? 90 : 60,
    minimumTechnicalRIR: 5,
    metadataNotes: ['Preparation recovery is read from the source class notes; retain it with its source lift even if the combined slot changes.'],
  }
  preparation.taskUnits = sum(preparation.repsBySet) * sides
  preparation.rounds = preparation.repsBySet.length
  preparation.bouts = preparation.rounds * sides
  preparation.seconds = preparationSeconds(preparation)
  preparation.sourcePlanningSeconds = preparation.sourceActiveSeconds === null ? null
    : preparationSeconds({ ...preparation, activeSeconds: preparation.sourceActiveSeconds })
  if (upper && !firstUpper) preparation.metadataNotes.push('The original audit budgets preparation at approximately 3 seconds per rep. The normalized planning clock uses this lift’s complete 4-second working tempo; dose and recovery are unchanged. Both clocks are retained explicitly.')
  preparation.text = entry.preparation_text ?? `Load preparation, separate from working sets: ${preparation.repsBySet.map((reps) => `1 × ${reps}`).join(' then ')}${sides === 2 ? ' per arm' : ''}. Start very light; a second set is intermediate. Keep at least 5 technical reps in reserve. Rest 60 seconds between preparation rounds${sides === 2 ? ', 30 seconds between arms' : ''}, then ${preparation.beforeWorkingSeconds} seconds before working sets. Extra load-finding reps add actual workload and time.`
  if (record.seconds_including_rest !== undefined) assert.equal(preparation.seconds, record.seconds_including_rest, `${row.id}: source preparation timing reconciles`)
  assert.equal(preparation.taskUnits, record.task_units ?? record.task_repetitions, `${row.id}: source preparation quantities reconcile`)
  return preparation
}

/**
 * rootURL points to workout_plan/, e.g. new URL('../workout_plan/', import.meta.url).
 * Reads only source Markdown/workload files; no dependency on generated portal
 * data, so importing this while rebuilding the portal cannot read stale output.
 * Returned keys each contain twelve sessions; every session has all 14 entries.
 */
export function loadForceSourceData(rootURL = new URL('../../workout_plan/', import.meta.url)) {
  const root = rootURL instanceof URL ? rootURL : new URL(rootURL)
  return Object.fromEntries(Object.entries(tracks).map(([programId, folder]) => [programId,
    Array.from({ length: 12 }, (_, index) => {
      const n = index + 1
      const suffix = String(n).padStart(2, '0')
      const source = new URL(`${folder}/`, root)
      const markdown = readFileSync(new URL(`classes/class_${suffix}.md`, source), 'utf8')
      const workloadText = readFileSync(new URL(`workload_class_${suffix}.json`, source), 'utf8')
      const workload = JSON.parse(workloadText)
      assert.equal(workload.class_number, n)
      assert.equal(workload.actual_observations, null, `${programId} ${n}: no athlete observations are inferred`)
      const upper = programId === 'upper-body-force'
      const firstUpper = upper && n === 1
      const parts = sections(markdown)
      const rows = markdownRows(parts)
      const records = firstUpper ? workload.entries : phases.flatMap(([, key]) => workload[key])
      const prepRecords = firstUpper ? workload.primary_preparation_sets : workload.primary_preparation
      assert.equal(records.length, 14)
      const exercises = records.map((rawEntry, i) => {
        const row = rows[i]
        const entry = firstUpper ? legacyUpperEntry(rawEntry, row) : rawEntry
        const phase = row.id[0]
        assert.equal(entry.name, row.name, `${programId} ${n} ${row.id}: source name agreement`)
        const metadataNotes = []
        if (upper) metadataNotes.push('Equipment categories are extracted from the source task name/cue; actual availability, fit and quantities remain unknown. Consult the source delivery conditions.')
        if (firstUpper) metadataNotes.push('Class 1 JSON does not specify per-row timing; rests and explicit tempos are recovered from its Markdown/audit. Active seconds include a planning estimate for decisive/rapid motion unless the whole cycle is timed explicitly; these are not measured durations.')
        if (firstUpper) metadataNotes.push('Class 1 does not split job, cue, replacement or identity into structured fields; the complete source instruction and all source phase/delivery notes are preserved instead.')
        const eventsPerRep = upper ? upperEvents(entry, phase) : clone(entry.exposure_per_rep)
        if (!upper && eventsPerRep.bilateral_landings) eventsPerRep.individual_landing_foot_contacts = 2 * eventsPerRep.bilateral_landings + (eventsPerRep.unilateral_landings ?? 0)
        else if (!upper && eventsPerRep.unilateral_landings) eventsPerRep.individual_landing_foot_contacts = eventsPerRep.unilateral_landings
        if (!upper && entry.key === 'walkout') eventsPerRep.walkout_heel_placements = 8
        const exercise = {
          id: row.id, phase, sourceProgramId: programId, sourceClass: n, sourceExerciseId: row.id,
          sourceKey: `${programId}:${n}:${row.id}`, sourcePath: `${folder}/classes/class_${suffix}.md`,
          sourceWorkloadPath: `${folder}/workload_class_${suffix}.json`,
          name: row.name, sourceName: row.name, dose: row.dose, sourceDose: row.dose,
          instruction: row.instruction, sourceInstruction: row.instruction, sourceMarkdownRow: row.markdown,
          sourceEntry: clone(rawEntry),
          sourcePhaseText: parts[String(phases.findIndex(([prefix]) => prefix === phase) + 2)],
          job: entry.job, cue: entry.cue, replacement: entry.replacement,
          identity: entry.identity, key: entry.key, kind: entry.kind ?? null,
          novelty: entry.novelty, noveltyReason: entry.uniqueness_reason ?? entry.novelty_reason ?? null,
          sets: entry.sets, reps: entry.reps, sides: entry.sides, unit: entry.unit ?? 'reps',
          sideLabel: entry.side_label ?? (upper ? 'arm' : 'leg'),
          activeSeconds: entry.active_seconds, resetSeconds: entry.reset_seconds,
          sourceActiveSeconds: firstUpper ? null : entry.active_seconds,
          timingBasis: firstUpper ? 'Explicit Class 1 tempo/rest plus declared active-motion planning estimates' : 'Source workload timing metadata; prescribed planning duration, not observed performance',
          resetPatternSeconds: entry.reset_pattern_seconds ? [...entry.reset_pattern_seconds] : null,
          sideRestSeconds: entry.side_rest_seconds ?? entry.side_rest,
          setRestSeconds: entry.rest_seconds ?? entry.rest,
          sourceTransitionRestSeconds: transitionSeconds(row.id),
          equipment: entry.equipment ? [...entry.equipment] : upperEquipment(entry.name, entry.cue),
          eventsPerRep,
          eventAggregationNotes: 'Event families and their subsets/aliases must not be added together as a total workload or joint-load score. Upper throw kind, throws and bilateral/unilateral throws describe the same releases; low-amplitude lower landings are a subset of bilateral landings; foot and hand contacts remain separate.',
          contralateralSupportSecondsPerArm: entry.contralateral_support_seconds_per_arm ?? 0,
          metadataNotes, actual: null,
        }
        const prepRecord = prepRecords.find(({ slot }) => slot === row.id)
        exercise.preparation = preparationFor(entry, prepRecord, row, upper, firstUpper)
        exercise.sourcePreparationRecord = prepRecord ? clone(prepRecord) : null
        exercise.preparationText = exercise.preparation?.text ?? null
        exercise.rest = entry.rest_text ?? ([
          exercise.sets > 1 && `${exercise.setRestSeconds} s between complete set rounds`,
          exercise.sides > 1 && `${exercise.sideRestSeconds} s between ${exercise.sideLabel} sides`,
          exercise.resetPatternSeconds ? `${exercise.resetPatternSeconds.join(' / ')} s between-rep gaps`
            : exercise.resetSeconds > 0 && `${exercise.resetSeconds} s between individual reps`,
          exercise.sourceTransitionRestSeconds > 0 && `${exercise.sourceTransitionRestSeconds} s before the next source exercise or section`,
        ].filter(Boolean).join('; ') || 'No additional source set or transition is prescribed.')
        exercise.sourceRest = exercise.rest
        exercise.taskUnits = taskUnits(exercise)
        exercise.rounds = exercise.sets
        exercise.bouts = exercise.sets * exercise.sides
        exercise.workingSeconds = workingSeconds(exercise)
        exercise.events = eventQuantities(exercise)
        assert.equal(normalizedDose(exercise), row.dose, `${exercise.sourceKey}: source dose agreement`)
        return exercise
      })
      assert.equal(exercises.filter(({ preparation }) => preparation).length, 6)
      return {
        n, programId, sourceFolder: folder, title: workload.title ?? `Class ${n}`,
        effort: workload.effort ?? plain(markdown.match(/^\*\*Primary effort:\*\*\s*(.+)$/m)?.[1] ?? ''),
        markdown, sections: parts, preparation: plain(parts['1']),
        exercises, ...Object.fromEntries(phases.map(([phase, key]) => [key, exercises.filter((entry) => entry.phase === phase)])),
        sourceHashes: { markdown: sha256(markdown), workload: sha256(workloadText) },
        sourceSummary: clone(workload.summary), sourceTiming: clone(workload.timing ?? null),
        sourcePhaseNotes: clone(workload.phase_notes ?? null), sourceWorkload: clone(workload),
        metadataNotes: ['Prescribed workload only. Source Access & Prepare 1, performed work, load, recovery and group queues remain unknown.'],
        actualObservations: null,
      }
    }),
  ]))
}
