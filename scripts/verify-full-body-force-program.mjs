import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { loadForceSourceData } from './lib/full-force-source-data.mjs'
import { validateFullBodyForceClass } from './lib/build-full-body-force.mjs'

// Read-only verification. --partial checks every class recorded as finalized,
// complete stages and the review chain without requiring future files or a
// published read model. Full mode additionally requires all 36 portal sessions.
const partial = process.argv.includes('--partial')
assert.ok(process.argv.slice(2).every(argument => argument === '--partial'), 'Supported option: --partial')
const repository = new URL('../', import.meta.url)
const root = new URL('workout_plan/', repository)
const base = new URL('full_body_force_generation/', root)
const read = (path, location = base) => readFileSync(new URL(path, location), 'utf8')
const json = (path, location = base) => JSON.parse(read(path, location))
const hash = text => createHash('sha256').update(text).digest('hex')
const sum = values => values.reduce((total, value) => total + value, 0)
const count = entry => entry.sets * entry.reps * entry.sides
const phases = ['E', 'S', 'P']
const forceIds = ['upper-body-force', 'lower-body-force']
const force = loadForceSourceData(root)
const originals = new Map(Object.values(force).flatMap(sessions => sessions.flatMap(session => session.exercises)).map(entry => [entry.sourceKey, entry]))
const state = json('progress.json')
const rotations = json('sources/rotation_selection.json')
const blueprint = json('sources/blueprints.json')
const revisionHistory = existsSync(new URL('revision_history.json', base)) ? json('revision_history.json').revisions : []
const failures = []
let checks = 0
function check(label, action) {
  checks += 1
  try { action() } catch (error) { failures.push(`${label}: ${error.message}`) }
}

function workClock(entry) {
  const gaps = entry.resetPatternSeconds ?? Array.from({ length: Math.max(0, entry.reps - 1) }, () => entry.resetSeconds)
  assert.equal(gaps.length, entry.reps - 1, `${entry.id}: between-rep gaps`)
  assert.ok(gaps.every(gap => Number.isFinite(gap) && gap >= 0))
  let seconds = 0
  for (let set = 0; set < entry.sets; set += 1) {
    for (let side = 0; side < entry.sides; side += 1) {
      seconds += entry.reps * entry.activeSeconds + sum(gaps)
      if (side + 1 < entry.sides) seconds += entry.sideRestSeconds
    }
    if (set + 1 < entry.sets) seconds += entry.setRestSeconds
  }
  return seconds
}

function prepClock(preparation) {
  if (!preparation) return 0
  let seconds = preparation.beforeWorkingSeconds
  for (const [index, reps] of preparation.repsBySet.entries()) {
    seconds += reps * preparation.sides * preparation.activeSeconds
    seconds += (preparation.sides - 1) * preparation.sideRestSeconds
    if (index + 1 < preparation.repsBySet.length) seconds += preparation.setRestSeconds
  }
  return seconds
}

function eventsFor(entries) {
  const result = {}
  for (const entry of entries) for (const [type, perRep] of Object.entries(entry.eventsPerRep)) {
    result[type] = (result[type] ?? 0) + count(entry) * perRep
  }
  return result
}

function comparePrep(actual, expected, label) {
  assert.ok(actual && expected, `${label}: same-lift preparation exists`)
  for (const field of ['repsBySet', 'sides', 'unit', 'activeSeconds', 'sideRestSeconds', 'setRestSeconds', 'beforeWorkingSeconds', 'minimumTechnicalRIR', 'taskUnits', 'rounds', 'bouts', 'seconds']) {
    assert.deepEqual(actual[field], expected[field], `${label}: preparation ${field}`)
  }
}

check('State and ordered file inventory', () => {
  assert.equal(state.target_class_count, 36)
  assert.equal(state.stages, 12)
  assert.equal(state.classes_per_stage, 3)
  assert.ok(Number.isInteger(state.last_finalized_class) && state.last_finalized_class > 0 && state.last_finalized_class <= 36)
  if (!partial) assert.equal(state.last_finalized_class, 36, 'Full verification requires every class; use --partial while authoring')
  assert.equal(state.next_class, state.last_finalized_class === 36 ? null : state.last_finalized_class + 1)
  assert.equal(state.actual_observations, null)
  assert.equal(state.observed_completed_classes, null)
  for (const [field, path] of [['finalized_file_paths', 'classes/class_NN.md'], ['workload_files', 'workload_class_NN.json'], ['audit_files', 'audits/class_NN_audit.md']]) {
    assert.deepEqual(state[field], Array.from({ length: state.last_finalized_class }, (_, index) => path.replace('NN', String(index + 1).padStart(2, '0'))))
  }
  const actualFiles = readdirSync(new URL('classes/', base)).filter(path => /^class_\d\d\.md$/.test(path)).sort()
  assert.deepEqual(actualFiles, state.finalized_file_paths.map(path => path.replace('classes/', '')).sort(), 'No unstated future or missing class files')
})

check('Original source manifest remains unchanged', () => {
  const manifest = json('sources/source_manifest.json')
  for (const [path, expected] of Object.entries(manifest.sha256)) assert.equal(hash(read(path, repository)), expected, path)
})

check('Post-review class revisions preserve original review provenance', () => {
  assert.ok(Array.isArray(revisionHistory))
  for (const revision of revisionHistory) {
    assert.match(revision.file, /^(?:classes\/class_\d\d\.md|workload_class_\d\d\.json|audits\/class_\d\d_audit\.md)$/)
    assert.match(revision.previous_sha256, /^[a-f0-9]{64}$/)
    assert.match(revision.current_sha256, /^[a-f0-9]{64}$/)
    assert.ok(Number.isInteger(revision.reviewed_by_class) && revision.reviewed_by_class > 1 && revision.reviewed_by_class <= state.last_finalized_class)
    assert.equal(Number(revision.file.match(/class_(\d\d)/)[1]), revision.reviewed_by_class - 1, 'Revision is for the reviewed prior class')
    assert.ok(typeof revision.reason === 'string' && revision.reason.trim().length >= 12, 'An explicit revision reason is required')
    assert.equal(revision.current_sha256, hash(read(revision.file)), `Revision current hash: ${revision.file}`)
  }
})

const records = Array.from({ length: state.last_finalized_class }, (_, index) => json(`workload_class_${String(index + 1).padStart(2, '0')}.json`))
const requiredReviewFiles = ['curriculum.md', 'progress.json', 'progression_ledger.md', 'drill_usage.md', 'strength_progressions.md', 'athlete_feedback.md', 'sources/source_manifest.json', 'sources/blueprints.json', 'sources/rotation_selection.json']
const forceWorkingFields = ['sets', 'reps', 'sides', 'unit', 'resetSeconds', 'resetPatternSeconds', 'sideRestSeconds', 'setRestSeconds', 'activeSeconds']
for (const record of records) {
  const n = record.class_number
  const suffix = String(n).padStart(2, '0')
  const stage = Math.floor((n - 1) / 3) + 1
  const variant = (n - 1) % 3
  const entries = record.entries
  const E = entries.filter(entry => entry.phase === 'E')
  const S = entries.filter(entry => entry.phase === 'S')
  const P = entries.filter(entry => entry.phase === 'P')
  check(`Class ${n}: Markdown and coach read-model agreement`, () => validateFullBodyForceClass(record, read(`classes/class_${suffix}.md`)))
  check(`Class ${n}: review chain and actuals`, () => {
    assert.equal(n, records.indexOf(record) + 1)
    assert.equal(record.stage, stage)
    assert.equal(record.lesson, 'ABC'[variant])
    for (const file of requiredReviewFiles) assert.match(record.reviewed_source_hashes[file] ?? '', /^[a-f0-9]{64}$/, `Reviewed ${file}`)
    if (n > 1) {
      const prior = String(n - 1).padStart(2, '0')
      for (const file of [`classes/class_${prior}.md`, `workload_class_${prior}.json`, `audits/class_${prior}_audit.md`]) {
        const reviewedHash = record.reviewed_source_hashes[file]
        const currentHash = hash(read(file))
        assert.match(reviewedHash ?? '', /^[a-f0-9]{64}$/, `Reviewed previous file ${file}`)
        if (reviewedHash !== currentHash) {
          assert.ok(revisionHistory.some(revision => revision.file === file
            && revision.previous_sha256 === reviewedHash && revision.current_sha256 === currentHash
            && revision.reviewed_by_class === n && typeof revision.reason === 'string' && revision.reason.trim().length >= 12),
          `Review hash changed for ${file}; require its exact old/current hashes, reviewing class and reason in revision_history.json`)
        }
      }
    }
    assert.deepEqual(record.source_force_hashes.upper, force['upper-body-force'][stage - 1].sourceHashes)
    assert.deepEqual(record.source_force_hashes.lower, force['lower-body-force'][stage - 1].sourceHashes)
    assert.equal(record.actual_observations, null)
    for (const field of ['actual_workload', 'access_prepare_1_workload', 'complete_session_minutes']) assert.equal(record.summary[field], null)
    assert.equal(record.strength_trace.length, 8)
    for (const trace of record.strength_trace) assert.equal(trace.actualLoad, null)
    for (const entry of entries) assert.equal(entry.actual, null)
  })
  check(`Class ${n}: composition and full source coverage flags`, () => {
    assert.deepEqual([E.length, S.length, P.length], [6, 2, 6])
    assert.deepEqual(entries.map(entry => entry.id), ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'S1', 'S2', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'])
    for (const group of [E, P]) for (const [program, expected] of [['upper-body-force', 2], ['lower-body-force', 2], ['rotation-upper', 1], ['rotation-lower', 1]]) {
      assert.equal(group.filter(entry => entry.sourceProgramId === program).length, expected)
    }
    for (const entry of entries) {
      const original = forceIds.includes(entry.sourceProgramId) && !(variant === 2 && entry.phase === 'S')
      assert.equal(entry.isOriginalCoverage, original, `${entry.id}: original versus added work flag`)
      assert.equal(entry.isAddedSupport, !original)
    }
    assert.deepEqual(record.source_coverage.slice().sort(), entries.filter(entry => entry.isOriginalCoverage).map(entry => entry.sourceKey).sort())
    const planned = blueprint.stages[stage - 1]
    for (const [program, prefix] of [['upper-body-force', 'upper'], ['lower-body-force', 'lower']]) for (const phase of ['E', 'P']) {
      assert.deepEqual(entries.filter(entry => entry.sourceProgramId === program && entry.phase === phase).map(entry => Number(entry.sourceExerciseId.slice(1))).sort(), planned[`${prefix}${phase}`][variant].slice().sort())
    }
    for (const [index, entry] of S.entries()) assert.equal(entry.sourceExerciseId, `S${variant === 2 ? planned.sRepeat[index] : variant + 1}`)
  })
  check(`Class ${n}: original force doses, tempo, recovery and preparation`, () => {
    for (const entry of entries.filter(entry => forceIds.includes(entry.sourceProgramId))) {
      const source = originals.get(entry.sourceKey)
      assert.ok(source, `${entry.id}: exact original source key`)
      assert.equal(source.sourceClass, stage)
      for (const field of forceWorkingFields) assert.deepEqual(entry[field], source[field], `${entry.id}: unchanged ${field}`)
      assert.equal(entry.name, source.name)
      assert.equal(entry.dose, source.dose)
      assert.equal(entry.sourceInstruction, source.sourceInstruction)
      assert.deepEqual(entry.eventsPerRep, source.eventsPerRep)
      if (entry.phase === 'P') comparePrep(entry.preparation, source.preparation, entry.id)
      else assert.equal(entry.preparation, null)
    }
  })
  check(`Class ${n}: reduced rotational selection and no added landing`, () => {
    const selection = rotations.stages[stage - 1]
    for (const entry of entries.filter(entry => entry.sourceProgramId.startsWith('rotation-'))) {
      const key = `${entry.sourceProgramId === 'rotation-upper' ? 'upper' : 'lower'}${entry.phase === 'P' ? 'Primary' : ''}`
      const source = selection[key][variant]
      assert.equal(entry.sourceKey, `${source.sourceProgramId}:${source.sourceClass}:${source.sourceSlot}`)
      assert.equal(entry.name, source.originalName)
      assert.equal(entry.sourceInstruction, source.fullSourceRow)
      assert.ok(read(source.sourcePath, repository).includes(source.fullSourceRow), `${entry.id}: source row exists verbatim`)
      for (const field of ['sets', 'reps', 'sides']) assert.equal(entry[field], source.combinedDose[field], `${entry.id}: rotation ${field}`)
      assert.equal(entry.sideRestSeconds, source.side_rest_seconds)
      assert.equal(entry.activeSeconds, source[entry.phase === 'E' ? 'active_seconds_per_attempt' : 'active_seconds_per_rep'])
      assert.equal(entry.resetSeconds, entry.phase === 'E' ? source.reset_seconds : 0)
      assert.equal(entry.job, source.combinedJob)
      assert.equal(entry.cue, source.combinedCue)
      assert.equal(entry.replacement, source.combinedReplacement)
      assert.deepEqual(entry.equipment, source.equipment)
      assert.ok(entry.doseAdjustment, 'Rotation dose change is disclosed')
      if (entry.phase === 'E') {
        assert.deepEqual(entry.eventsPerRep, source.events_per_attempt)
        assert.equal((entry.events.bilateral_landings ?? 0) + (entry.events.unilateral_landings ?? 0), 0)
        assert.equal(entry.preparation, null)
        assert.ok(count(entry) <= source.originalDose.sets * source.originalDose.reps * source.originalDose.sides, 'Combined dose does not exceed original rotation dose')
      } else {
        const prep = source.preparation
        assert.deepEqual(entry.preparation.repsBySet, [prep.reps])
        assert.equal(entry.preparation.sides, prep.sides)
        assert.equal(entry.preparation.sideRestSeconds, prep.side_rest_seconds)
        assert.equal(entry.preparation.beforeWorkingSeconds, prep.rest_before_work_seconds)
        assert.equal(entry.preparation.minimumTechnicalRIR, prep.RIR_min)
      }
    }
  })
  check(`Class ${n}: independent workload and clock arithmetic`, () => {
    for (const entry of entries) {
      assert.equal(entry.taskUnits, count(entry), entry.id)
      assert.equal(entry.workingSeconds, workClock(entry), `${entry.id}: active/reset/round/side clock`)
      assert.deepEqual(entry.events, eventsFor([entry]), `${entry.id}: event quantities`)
      if (entry.preparation) {
        assert.equal(entry.preparation.taskUnits, sum(entry.preparation.repsBySet) * entry.preparation.sides)
        assert.equal(entry.preparation.seconds, prepClock(entry.preparation), `${entry.id}: prep clock`)
      }
    }
    const summary = record.summary
    const events = eventsFor(E)
    const releases = group => sum(group.map(entry => count(entry) * ((entry.eventsPerRep.throws ?? 0) + (entry.eventsPerRep.slams ?? 0))))
    events.ball_releases = releases(E)
    events.nonrotational_ball_releases = releases(E.filter(entry => forceIds.includes(entry.sourceProgramId)))
    events.rotational_ball_releases = releases(E.filter(entry => entry.sourceProgramId.startsWith('rotation-')))
    events.source_throw_event_alias = events.throws ?? 0
    events.source_rotational_slam_event_alias = events.slams ?? 0
    delete events.throws
    delete events.slams
    events.nonrotational_downward_slam_releases = releases(E.filter(entry => entry.sourceProgramId === 'upper-body-force' && /slam/i.test(entry.name)))
    events.rotational_slam_releases = events.source_rotational_slam_event_alias
    events.downward_slam_releases = events.nonrotational_downward_slam_releases + events.rotational_slam_releases
    events.other_ball_releases = events.ball_releases - events.downward_slam_releases
    for (const key of new Set([...Object.keys(events), ...Object.keys(summary.explosive_events)])) assert.equal(summary.explosive_events[key], events[key] ?? 0, `event ${key}`)
    for (const [key, expected] of Object.entries({
      explosive_rounds: sum(E.map(entry => entry.sets)), explosive_bouts: sum(E.map(entry => entry.sets * entry.sides)),
      light_reps: sum(S.map(count)), light_bouts: sum(S.map(entry => entry.sets * entry.sides)),
      primary_rounds: sum(P.map(entry => entry.sets)), primary_bouts: sum(P.map(entry => entry.sets * entry.sides)),
      primary_reps: sum(P.filter(entry => entry.unit !== 'cycles').map(count)), primary_walkout_cycles: sum(P.filter(entry => entry.unit === 'cycles').map(count)),
      preparation_reps: sum(P.filter(entry => entry.preparation.unit !== 'cycles').map(entry => sum(entry.preparation.repsBySet) * entry.preparation.sides)),
      preparation_walkout_cycles: sum(P.filter(entry => entry.preparation.unit === 'cycles').map(entry => sum(entry.preparation.repsBySet) * entry.preparation.sides)),
    })) assert.equal(summary[key], expected, key)
    let workSeconds = 0
    for (const [phase, key] of [['E', 'explosive_seconds'], ['S', 'resilience_seconds'], ['P', 'primary_seconds']]) {
      const expected = sum(entries.filter(entry => entry.phase === phase).map(entry => workClock(entry) + prepClock(entry.preparation) + entry.transitionRestSeconds))
      assert.equal(record.timing[key], expected, key)
      workSeconds += expected
    }
    const allowance = record.timing.extra_instruction_setup_seconds
    assert.deepEqual(allowance, [720, 1080])
    assert.deepEqual(summary.estimated_post_prepare_minutes, [Math.floor((workSeconds + allowance[0]) / 60), Math.ceil((workSeconds + allowance[1]) / 60)])
    assert.equal(P.at(-1).transitionRestSeconds, 0, 'No duplicated terminal recovery')
  })
}

const covered = records.flatMap(record => record.entries.filter(entry => entry.isOriginalCoverage))
check('Original force coverage has no duplication', () => assert.equal(new Set(covered.map(entry => entry.sourceKey)).size, covered.length))
for (let stage = 1; stage <= Math.floor(records.length / 3); stage += 1) check(`Stage ${stage}: all 28 original force rows occur once`, () => {
  const actual = covered.filter(entry => entry.sourceClass === stage).map(entry => entry.sourceKey).sort()
  const expected = forceIds.flatMap(program => force[program][stage - 1].exercises.map(entry => entry.sourceKey)).sort()
  assert.deepEqual(actual, expected)
})

if (!partial || records.length === 36) check('Complete original force totals and 336-row coverage', () => {
  assert.equal(covered.length, 336)
  assert.deepEqual(covered.map(entry => entry.sourceKey).sort(), [...originals.keys()].sort())
  const originalP = covered.filter(entry => entry.phase === 'P')
  assert.equal(sum(originalP.filter(entry => entry.unit === 'reps').map(count)), 1190)
  assert.equal(sum(originalP.filter(entry => entry.unit === 'cycles').map(count)), 28)
  assert.equal(sum(originalP.filter(entry => entry.unit === 'cycles').map(entry => entry.events.walkout_heel_placements)), 224)
  assert.equal(sum(originalP.filter(entry => entry.preparation.unit === 'cycles').map(entry => entry.preparation.taskUnits)), 12)
  const events = eventsFor(covered.filter(entry => entry.phase === 'E'))
  for (const [key, expected] of Object.entries({ throws: 131, catches: 22, bilateral_hand_landing_events: 16, individual_hand_contacts: 32, bilateral_landings: 88, individual_landing_foot_contacts: 176, unilateral_takeoffs: 8, sprint_attempts: 2, sprint_metres: 4, low_amplitude_landings: 13, grounded_rapid_reps: 156, approach_steps: 14, movement_steps: 18 })) assert.equal(events[key], expected, key)
  assert.equal(events.unilateral_landings ?? 0, 0)
})

if (!partial) check('Athleticism Accelerator contains the exact 36 saved sessions', () => {
  const portal = json('src/coach/data/acceleratorPrograms.json', repository)['full-body-force']
  assert.ok(portal, 'Full Body Force Generation program is present')
  assert.equal(portal.length, 36)
  assert.deepEqual(portal, records.map(record => record.session))
})

if (failures.length) {
  console.error(`Full Body Force Generation: ${failures.length} failing checks of ${checks}.`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Verified ${records.length}/36 Full Body Force Generation classes, ${records.length * 14} rows, ${covered.length}/336 original force prescriptions, ${checks} checks${partial ? ' (partial authoring mode; full portal verification deferred)' : ', including all 36 portal sessions'}. Actual athlete work remains unknown.`)
}
