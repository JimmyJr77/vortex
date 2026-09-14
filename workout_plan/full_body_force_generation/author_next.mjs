import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { validateFullBodyForceClass } from '../../scripts/lib/build-full-body-force.mjs'
import { loadForceSourceData, workingSeconds, preparationSeconds, taskUnits, eventQuantities } from '../../scripts/lib/full-force-source-data.mjs'

const base = new URL('./', import.meta.url)
const root = new URL('../', base)
const read = file => readFileSync(new URL(file, base), 'utf8')
const json = file => JSON.parse(read(file))
const save = (file, value) => writeFileSync(new URL(file, base), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`)
const append = (file, text) => appendFileSync(new URL(file, base), text)
const hash = text => createHash('sha256').update(text).digest('hex')
const clone = value => structuredClone(value)
const sum = values => values.reduce((a, b) => a + b, 0)
const plain = text => text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
const identityAliases = json('sources/semantic_identity_review.json')
const explosiveIdentity = e => identityAliases.find(a => a.sourceProgramId === e.sourceProgramId && a.sourceClass === e.sourceClass && a.sourceExerciseId === e.sourceExerciseId)?.identityKey ?? `${e.sourceProgramId}:${e.name}`
const trackNames = { 'upper-body-force': 'Upper Body Force Generation', 'lower-body-force': 'Lower Body Force Generation', 'rotation-upper': 'Upper-body rotational power', 'rotation-lower': 'Lower-body rotational power' }
const folders = { 'upper-body-force': 'upper_body_force_generation', 'lower-body-force': 'lower_body_force_generation', 'rotation-upper': 'rotational_explosiveness_upper_body', 'rotation-lower': 'rotational_explosiveness_lower_body' }
const prepare = 'Complete the existing predetermined Access & Prepare 1, unchanged and supplied separately. Its exercises, duration and workload are not recreated or assumed. Review its actual demands before this full-body class.'
const setupBase = 'Inspect all loads, stable supports, band/landmine attachments, surfaces and athlete fit. Use the three separate 10 m lanes with complete setup, action and receiving/stopping envelopes inside the available space; do not combine them into a 30 m runway. Clear waiting/return paths outside active ball and swept-leg areas. Ball flight, impact, bounce and roll containment require a separately verified area; no throwing wall or rebound behavior is assumed. Only tasks that explicitly prescribe a feed or receiving action include it; all other releases are no-catch. Retrieve only after the ball stops and the coach clears entry into the area. Low kicks are noncontact and below hip height, with active recoil and no knee snap or spin; qualify kicking competence during the prescribed first attempts. For a handoff, secure the ball and let the feeder release and step clear before turning; no airborne feed is added. Finish each exercise and its recovery, then clear/reset the area before the next. Mechanical connections do not authorize simultaneous jump/kick/throw combinations or supersets. Before multiple substitutions, check that they do not duplicate another slot; otherwise stop the affected work and record a modified/incomplete delivery for revision.'
const scheduling = 'Class numbers specify 36 ordered exposures, not consecutive days or a fixed 36-week calendar. Review actual sport, lifting, throwing, kicking, running, jumping and separate tumbling before scheduling. Roughly 48–72 hours between comparably demanding exposures is an initial planning allowance, adjusted to actual recovery. Do not also perform the standalone source workouts or double up missed classes. No athlete completion or readiness is inferred from a saved class.'
const phaseNotes = {
  E: ['Six separate explosive tasks: two upper force, two lower force, one upper rotation and one lower rotation. The opener is today’s main quality observation; every other task has a specific supporting job. Use bodyweight/light resistance and rapid intent with controlled execution, preserving the written reset and side/set recovery. Extend rest to 2–3 minutes when needed. A miss consumes the attempt; no bonus test or make-up reps.', 'Stop for pain, unsafe implement path, trapped support knee, uncontrolled reception, lost alignment or clear slowing. Regress only remaining work when control returns; otherwise log the stopped slot. Source alternative doses are capped by the remaining combined dose. No new flight is added by the rotational selections.'],
  S: ['Exactly two light strengthening tasks, one for each region. Keep at least 5 technical reps/cycles in reserve; do not chase burn or fatigue. Preserve the source tempo and any counted hold/relaxation. Stop or reduce range/load if control fades.'],
  P: ['Six challenging primary-strength tasks: two from each force course plus one upper and one lower rotational support. Use about 2–3 technical reps/cycles in reserve with controlled lowering/range. No forced reps, failure/max testing or breathless circuit. Same-lift preparation is separate from working sets; extra load finding adds actual work/time.', 'The original force-course doses and preparation stay with their source exercises. Added rotational support uses the clearly stated smaller combined dose and its own easy preparation. A new class or changed position in the sequence does not justify a load increase. Judge late-session technical reserve and record reductions rather than forcing nominal completion.'],
}

function legacyReplacement(e) {
  const replacements = {
    E1: 'use a lighter, grippable ball with the same stationary release and remaining dose; if no contained release is feasible, use rapid light-dumbbell floor presses for remaining attempts with the same resets',
    E2: 'use a light seated bilateral band row with a 3 s settled extended-arm start at the same remaining dose/rest if the minimum landmine load or secure grip is unsuitable',
    E3: 'use a higher inspected hand support for the same small release; if no controlled hand flight is possible, use a rapid incline push-up without flight for remaining reps and record removed hand contacts',
    E4: 'use a smaller dip and lighter ball; if no contained release is feasible, use grounded rapid standing light-band presses with the same single small dip, remaining dose and resets',
    E5: 'use a lighter intact band at the same remaining dose; if the permitted foot anchor cannot be secured, use a light bilateral dumbbell hinge row with the same rapid draw and controlled return',
    E6: 'use a lighter ball or shorter release range; if release containment fails, use a rapid one-arm light-dumbbell floor press with the same remaining per-arm dose/rest',
    S1: 'use a smaller controlled shoulder-blade excursion at the same easy dose; do not turn it into an elbow-bending push-up',
    S2: 'use a lighter band or smaller outward rotation at the same easy dose, with elbows at the ribs',
    P1: 'use lighter dumbbells and the same comfortable floor-limited range while preserving the stated reserve',
    P2: 'use a lighter dumbbell and stable hand support through the same controlled row range; no unsupported torso twist',
    P3: 'use higher stable hand support or appropriate resistance to retain the same controlled reps and technical reserve',
    P4: 'use lighter dumbbells and a smaller controlled rear-delt row range; keep the hinge still',
    P5: 'use lighter dumbbells with the same floor-supported elbow-extension action and comfortable range',
    P6: 'use lighter dumbbells with the same simultaneous neutral-grip curl and controlled range',
  }
  return replacements[e.sourceExerciseId]
}
function context(text, e, entries, force) {
  return (text ?? '').replace(/\b([ESP][1-6])\b/g, (id) => {
    const local = entries.find(other => other.sourceProgramId === e.sourceProgramId && other.sourceClass === e.sourceClass && other.sourceExerciseId === id)
    if (local) return local.id
    const source = force[e.sourceProgramId]?.[e.sourceClass - 1]?.exercises.find(other => other.id === id)
    return source ? `the source exercise “${source.name}”` : `source ${id}`
  }).replace('Record the quality marker above.', 'Record fixed feet, quiet trunk and straight-line release within these attempts.')
}
function forceEntry(source, extraSupport = false) {
  const e = clone(source)
  delete e.sourcePhaseText
  e.isOriginalCoverage = !extraSupport
  e.isAddedSupport = extraSupport
  e.doseAdjustment = null
  e.originalDose = { sets: e.sets, reps: e.reps, sides: e.sides, unit: e.unit, text: e.sourceDose }
  e.rawCoaching = e.job ? `${e.job} ${e.cue}` : e.sourceInstruction
  e.replacement = e.replacement ?? legacyReplacement(e)
  e.instructionOrigin = 'Original source movement, intent and dose; obsolete cross-row pointers are contextualized for the combined class.'
  return e
}
function rotationEntry(source, phase) {
  assert.ok(source.combinedCue && source.combinedJob && source.combinedReplacement && source.equipment, 'Rotation selection must include reviewed combined coaching fields')
  const c = source.combinedDose
  const alternating = c.sides === 1
  const e = {
    sourceProgramId: source.sourceProgramId, sourceClass: source.sourceClass, sourceExerciseId: source.sourceSlot,
    sourceKey: `${source.sourceProgramId}:${source.sourceClass}:${source.sourceSlot}`,
    sourcePath: `${folders[source.sourceProgramId]}/classes/class_${String(source.sourceClass).padStart(2, '0')}.md`,
    sourceHash: source.source_sha256 ?? null, phase,
    name: source.originalName, sourceName: source.originalName,
    sourceDose: source.originalDose?.dose_text ?? source.originalDoseText,
    sourceInstruction: source.fullSourceRow, identity: source.sourceIdentityNote ?? 'Source family and declared execution retained; canonical/proposed boundaries belong to the source library audit.',
    key: source.sourceExerciseRecord?.key ?? source.originalName,
    sets: c.sets, reps: c.reps, sides: c.sides, unit: alternating ? 'traverses' : 'reps', sideLabel: phase === 'E' ? 'side/direction' : 'side',
    activeSeconds: phase === 'E' ? source.active_seconds_per_attempt : source.active_seconds_per_rep,
    resetSeconds: phase === 'E' ? source.reset_seconds : 0, resetPatternSeconds: null,
    sideRestSeconds: source.side_rest_seconds, setRestSeconds: phase === 'P' ? 120 : 90,
    sourceTransitionRestSeconds: source.between_exercises_seconds,
    eventsPerRep: phase === 'E' ? source.events_per_attempt : { strength_reps: 1 },
    equipment: source.equipment, job: source.combinedJob, cue: source.combinedCue, rawCoaching: `${source.combinedJob} ${source.combinedCue}`,
    replacement: source.combinedReplacement,
    originalDose: source.originalDose ?? { text: source.originalDoseText },
    doseAdjustment: phase === 'E' ? source.doseOverrideReason : 'One smaller challenging support set beside four retained force-primary entries; no automatic load increase. Stage 6 uses four reps per side or four alternating traverses.',
    isOriginalCoverage: false, isAddedSupport: true, actual: null,
    timingBasis: 'Explicit combined planning allowance, including controlled finish/reset actions; not observed performance.',
    metadataNotes: [source.restNote ?? 'Combined rotational dose and preparation are independent of original course volume; source dose is retained in provenance.'],
    novelty: 'source_selection', noveltyReason: 'A previously authored directly relevant rotational execution selected for its specific job; new placement is not a novel drill.',
  }
  e.dose = `${e.sets} × ${e.reps}${alternating ? ' alternating traverses total' : ' per side/direction'}`
  if (phase === 'P') {
    const p = source.preparation
    e.preparation = { sourceSlot: source.sourceSlot, repsBySet: [p.reps], sides: p.sides, unit: e.unit, sideLabel: 'side', activeSeconds: e.activeSeconds, sideRestSeconds: p.side_rest_seconds, setRestSeconds: 60, beforeWorkingSeconds: p.rest_before_work_seconds, minimumTechnicalRIR: 5 }
    e.preparation.taskUnits = p.reps * p.sides; e.preparation.rounds = 1; e.preparation.bouts = p.sides
    e.preparation.seconds = preparationSeconds(e.preparation)
    e.preparation.text = `Preparation of this same lift: 1 × ${p.reps}${p.sides === 1 ? ' alternating one-way traverses total' : ' per side'}, very light at ≥5 technical RIR; ${p.sides === 2 ? `${p.side_rest_seconds} s between sides; ` : ''}${p.rest_before_work_seconds} s before working. Use the same controlled movement/return tempo; extra ramps add actual work and time.`
  } else e.preparation = null
  return e
}
function restText(e) {
  const parts = []
  if (e.sets > 1) parts.push(`${e.setRestSeconds} s between complete set rounds`)
  if (e.sides > 1) parts.push(`${e.sideRestSeconds} s between ${e.sideLabel} bouts; ${taskUnits(e)} total ${e.unit}`)
  if (e.resetPatternSeconds) parts.push(`between-rep gaps ${e.resetPatternSeconds.join(' / ')} s`)
  else if (e.resetSeconds > 0 && e.reps > 1) parts.push(`${e.resetSeconds} s between individual reps`)
  if (e.transitionRestSeconds) parts.push(`${e.transitionRestSeconds} s before ${e.phase === 'P' ? 'the next lift preparation' : 'the next exercise/section'}`)
  return parts.join('; ') || 'Finish this working bout; no additional set or finisher is prescribed.'
}
function totalsFor(entries) {
  const E = entries.filter(e => e.phase === 'E'), S = entries.filter(e => e.phase === 'S'), P = entries.filter(e => e.phase === 'P')
  const events = {}
  for (const e of E) {
    const v = eventQuantities(e)
    for (const [k, value] of Object.entries(v)) events[k] = (events[k] ?? 0) + value
    const releases = (v.throws ?? 0) + (v.slams ?? 0)
    events.ball_releases = (events.ball_releases ?? 0) + releases
    const tag = e.sourceProgramId.startsWith('rotation-') ? 'rotational_ball_releases' : 'nonrotational_ball_releases'
    events[tag] = (events[tag] ?? 0) + releases
  }
  // Keep legacy source counters explicitly named; they use different slam conventions.
  events.source_throw_event_alias = events.throws ?? 0
  events.source_rotational_slam_event_alias = events.slams ?? 0
  delete events.throws
  delete events.slams
  events.nonrotational_downward_slam_releases = sum(E.filter(e => e.sourceProgramId === 'upper-body-force' && /slam/i.test(e.name)).map(e => taskUnits(e) * (e.eventsPerRep.throws ?? 0)))
  events.rotational_slam_releases = events.source_rotational_slam_event_alias
  events.downward_slam_releases = events.nonrotational_downward_slam_releases + events.rotational_slam_releases
  events.other_ball_releases = events.ball_releases - events.downward_slam_releases
  for (const key of ['ball_releases','rotational_ball_releases','nonrotational_ball_releases','bilateral_landings','unilateral_landings','individual_landing_foot_contacts','unilateral_takeoffs','low_amplitude_landings','bilateral_hand_landing_events','individual_hand_contacts','catches','handoffs','kick_actions','lower_grounded_rotational_efforts','upper_rotational_retained_or_unloaded_efforts','grounded_rapid_reps','sprint_attempts','sprint_metres','approach_steps','movement_steps']) events[key] ??= 0
  return {
    exercise_counts: { explosive: 6, resilience: 2, primary: 6 }, explosive_events: events,
    explosive_rounds: sum(E.map(e => e.sets)), explosive_bouts: sum(E.map(e => e.sets * e.sides)),
    light_reps: sum(S.map(taskUnits)), light_bouts: sum(S.map(e => e.sets * e.sides)),
    primary_rounds: sum(P.map(e => e.sets)), primary_bouts: sum(P.map(e => e.sets * e.sides)),
    primary_reps: sum(P.filter(e => e.unit !== 'cycles').map(taskUnits)), primary_walkout_cycles: sum(P.filter(e => e.unit === 'cycles').map(taskUnits)),
    preparation_reps: sum(P.filter(e => e.preparation.unit !== 'cycles').map(e => e.preparation.taskUnits)), preparation_walkout_cycles: sum(P.filter(e => e.preparation.unit === 'cycles').map(e => e.preparation.taskUnits)),
    actual_workload: null, access_prepare_1_workload: null, complete_session_minutes: null,
  }
}
function workloadText(s) {
  const e = s.explosive_events
  return `${e.nonrotational_ball_releases} nonrotational and ${e.rotational_ball_releases} rotational ball releases, including ${e.nonrotational_downward_slam_releases} nonrotational downward slams and ${e.rotational_slam_releases} rotational slams already included in those release totals; ${e.catches} source ball-receiving events and ${e.handoffs} rotational handoffs counted separately. ${e.bilateral_landings} bilateral / ${e.unilateral_landings} unilateral foot-landings (${e.individual_landing_foot_contacts} individual landing-foot contacts), with ${e.low_amplitude_landings} low-amplitude events already included; ${e.unilateral_takeoffs} unilateral takeoffs. ${e.bilateral_hand_landing_events} bilateral hand-receptions / ${e.individual_hand_contacts} hand contacts. ${e.grounded_rapid_reps} grounded rapid leg reps, ${e.lower_grounded_rotational_efforts} grounded lower-rotation efforts (including ${e.kick_actions} kick actions) and ${e.upper_rotational_retained_or_unloaded_efforts} retained/unloaded upper-rotation efforts. ${e.sprint_attempts} short starts / ${e.sprint_metres} accelerating metres; ${e.approach_steps} counted lower source-force walking-entry steps and ${e.movement_steps} counted upper source-force task steps. Rotational entry/recovery foot placements belong to complete rotational attempts and are not separately enumerated. Primary: ${s.primary_rounds} rounds / ${s.primary_bouts} side-specific bouts, ${s.primary_reps} conventional/one-way-traverse reps plus ${s.primary_walkout_cycles} complete walkout cycles (${s.primary_walkout_cycles * 8} heel placements). Preparation: ${s.preparation_reps} reps/traverses plus ${s.preparation_walkout_cycles} walkout cycles, separate from work. Light supports: ${s.light_reps} reps/cycles. These mixed units are prescribed descriptions, not equivalent stress or actual completed work.`
}

const state = json('progress.json')
const n = state.next_class
assert.ok(n >= 1 && n <= 36, 'No next class remains; revise from actual feedback rather than generating Class 37.')
assert.equal(n, state.last_finalized_class + 1)
assert.ok(!existsSync(new URL(`classes/class_${String(n).padStart(2, '0')}.md`, base)), 'Never overwrite a finalized class during next-class authoring.')
const stage = Math.floor((n - 1) / 3) + 1, variant = (n - 1) % 3
const reviewed = ['curriculum.md','progress.json','progression_ledger.md','drill_usage.md','strength_progressions.md','athlete_feedback.md','sources/source_manifest.json','sources/blueprints.json','sources/rotation_selection.json']
reviewed.push('sources/semantic_identity_review.json')
if (n > 1) reviewed.push(`classes/class_${String(n - 1).padStart(2, '0')}.md`,`workload_class_${String(n - 1).padStart(2, '0')}.json`,`audits/class_${String(n - 1).padStart(2, '0')}_audit.md`)
const reviewedHashes = Object.fromEntries(reviewed.map(file => [file, hash(read(file))]))
const previous = n > 1 ? json(`workload_class_${String(n - 1).padStart(2, '0')}.json`) : null
const prior = Array.from({length:n-1}, (_,i) => json(`workload_class_${String(i+1).padStart(2,'0')}.json`))
const force = loadForceSourceData(root)
const blueprint = json('sources/blueprints.json').stages[stage-1]
const rotations = json('sources/rotation_selection.json').stages[stage-1]
const lesson = blueprint.lessons[variant]
const sourceRows = (program, phase, pair) => pair.map(id => forceEntry(force[program][stage-1].exercises.find(e => e.id === `${phase}${id}`)))
const UE = sourceRows('upper-body-force','E',blueprint.upperE[variant]), LE = sourceRows('lower-body-force','E',blueprint.lowerE[variant])
const RE = [rotationEntry(rotations.lower[variant],'E'), rotationEntry(rotations.upper[variant],'E')]
const E = variant === 0 ? [LE[0],UE[0],LE[1],UE[1],...RE] : variant === 1 ? [UE[0],LE[0],UE[1],LE[1],...RE] : [...RE,LE[0],UE[0],LE[1],UE[1]]
const sPair = variant === 2 ? blueprint.sRepeat : [variant + 1,variant + 1]
const S = ['upper-body-force','lower-body-force'].map((program,i) => forceEntry(force[program][stage-1].resilience[sPair[i]-1],variant===2))
const UP = sourceRows('upper-body-force','P',blueprint.upperP[variant]), LP = sourceRows('lower-body-force','P',blueprint.lowerP[variant])
const P = [LP[0],UP[0],LP[1],UP[1],rotationEntry(rotations.lowerPrimary[variant],'P'),rotationEntry(rotations.upperPrimary[variant],'P')]
const entries = [...E,...S,...P]
for (const [phase, es] of [['E',E],['S',S],['P',P]]) es.forEach((e,index) => { e.id=`${phase}${index+1}`;e.phase=phase })
for (const e of entries) {
  e.transitionRestSeconds = e.phase === 'E' ? Math.max(90,e.sourceTransitionRestSeconds) : e.phase === 'S' ? Math.max(e.id==='S1'?45:60,e.sourceTransitionRestSeconds) : e.id==='P6' ? 0 : Math.max(90,e.sourceTransitionRestSeconds)
  if (e.phase === 'P' && /Landmine Rotation|Cossack|Single-Leg Romanian|Split Squat/.test(e.name) && e.id!=='P6') e.transitionRestSeconds=Math.max(120,e.transitionRestSeconds)
  e.rest = restText(e)
  const sourceRole = e.phase === 'E' ? '' : e.phase === 'S' ? 'Keep this light support at ≥5 technical RIR. ' : 'Keep the working load at 2–3 technical reps/cycles in reserve. '
  e.coaching = context(`${sourceRole}${e.rawCoaching} Use instead: ${e.replacement.replace(/^use /i, '').replace(/\.+$/, '')}. This replacement uses only the remaining combined dose/rest unless explicitly stated; log changed support, event type, load and added time.`,e,entries,force)
  e.sourceReference = `${trackNames[e.sourceProgramId]} · source Class ${e.sourceClass} · ${e.sourceExerciseId}`
  e.dose = e.dose ?? `${e.sets} × ${e.reps}`
  e.sourceTrack = trackNames[e.sourceProgramId]
  e.events = eventQuantities(e); e.taskUnits=taskUnits(e); e.workingSeconds=workingSeconds(e)
}
assert.deepEqual([E.length,S.length,P.length],[6,2,6])
for (const phase of [E,P]) for (const [program,count] of [['upper-body-force',2],['lower-body-force',2],['rotation-upper',1],['rotation-lower',1]]) assert.equal(phase.filter(e=>e.sourceProgramId===program).length,count)
assert.equal(new Set(entries.map(e=>`${e.phase}:${e.name.toLowerCase().replace(/\W/g,'')}`)).size,14,'No duplicate same-phase exact exercises')
for (const e of entries) assert.ok(e.sets>0 && e.reps>0 && e.job!=='' && e.coaching && e.replacement && e.equipment.length)
for (const e of RE) assert.equal((e.events.bilateral_landings??0)+(e.events.unilateral_landings??0),0,'No added rotational landings')
const summary=totalsFor(entries)
const timing={}
for (const [phase,es] of [['explosive',E],['resilience',S],['primary',P]]) timing[`${phase}_seconds`]=sum(es.map(e=>e.workingSeconds+e.transitionRestSeconds+(e.preparation?.seconds??0)))
timing.extra_instruction_setup_seconds=[720,1080]
const total=timing.explosive_seconds+timing.resilience_seconds+timing.primary_seconds
const minutes=[Math.floor(total/60+12),Math.ceil(total/60+18)]
summary.estimated_post_prepare_minutes=minutes
const continuity=previous ? `Previous combined Class ${n-1} prescribed ${previous.summary.primary_bouts} primary bouts and ${previous.summary.primary_reps} conventional/traverse reps plus ${previous.summary.primary_walkout_cycles} cycles; this class prescribes ${summary.primary_bouts} bouts, ${summary.primary_reps} reps and ${summary.primary_walkout_cycles} cycles. This is a redistributed task dose, not an earned load increase.` : 'This is the first combined prescription; the source courses are written references, not evidence that these athletes completed them.'
const explosiveProgressionNote = existsSync(new URL('sources/explosive_progression_notes.json', base)) ? json('sources/explosive_progression_notes.json').find(item => item.class_number === n)?.note ?? '' : ''
const progression=`${explosiveProgressionNote ? explosiveProgressionNote + '\n\n' : ''}${continuity} ${stage===6?'Stage 6 deliberately retains the reduced force prescriptions and reduces rotation to one attempt per side and four working reps per side/traverse. ':''}${variant===2?'This third lesson completes stage coverage and repeats the selected light supports for the stated shoulder/hip/foot jobs. ':''}Original force doses/within-task recovery and same-lift preparation are retained; rotational additions are separately reduced. Advance only after actual controlled execution at the target reserve and satisfactory recovery. Hold, reduce or revise if feedback or first-attempt quality does not support the new constraint.`
const referenceMatches=stage===12?E.flatMap(e=>{const earlier=prior.find(d=>d.entries.some(x=>x.phase==='E'&&explosiveIdentity(x)===explosiveIdentity(e)&&x.dose===e.dose));return earlier?[`${e.id} matches the prescribed execution/dose in combined Class ${earlier.class_number}`]:[]}):[]
const referenceNote=stage===12?`For a repeated source reference, compare only an actually recorded earlier combined occurrence with matching dose, actual equipment, stance, arm strategy, range, reset, side/set rest, preparation and order. An unmatched or missing baseline is not zero or improvement. ${referenceMatches.length?referenceMatches.join('; ')+'. ':''}`:''
const quality=`Main observation: ${E[0].name}. Within its listed attempts, record the declared starting position, side, movement/receiving control and a stable finish. Also record the partner task in the first connection under its own criteria; do not treat unlike drills as equivalent force tests. ${referenceNote}A miss consumes the attempt; no additional testing slots or retries are added.`
const connections=lesson.connections.map((pair,index)=>({slots:[`E${index*2+1}`,`E${index*2+2}`],title:pair.title,cue:pair.cue}))
const specialSetup=entries.some(e=>e.sourceProgramId==='lower-body-force'&&e.sourceClass===3&&e.sourceExerciseId==='E6')?' Reserve the first 1 m for the full split starting stance, accelerate from 1 m to 3 m, and stop within the final 7 m. If actual stance/stopping does not fit, use the grounded replacement. Braking and return travel are not the counted acceleration metres.':''
const setup=setupBase+specialSetup
const delivery=`Estimate ${minutes[0]}–${minutes[1]} minutes after Access & Prepare 1 with prompt equipment access. Includes selected work, resets, side/set recovery, new-order transitions, same-lift preparation and 12–18 minutes extra instruction/setup. Additional recovery, queues or load finding add actual time. Existing preparation and complete booking duration remain unresolved. Never shorten needed recovery to fit a clock. ${scheduling}`
const work=workloadText(summary)
const auditFindings=`All 14 slots have a specific job, nonzero dose, cue, recovery and replacement. The six explosive slots include all four requested sources; the first task and three connections define the day's effort. Each retained source-force entry keeps its original set/rep/side dose, and added rotation uses a separate reduced dose with original provenance. No rotational landing is added. Similar muscle groups receive complementary initiation, transfer and finishing jobs; the light supports stay easy. ${variant===2?'The extra light supports are disclosed repeats rather than new work identities. ':''}Working/preparation time was recalculated after reordering; old source phase transitions are replaced by today's explicit recovery. Full duration and athlete response remain unknown.`
const strengthTrace=[...S,...P].map(e=>{const prev=[...prior].reverse().flatMap(d=>d.entries).find(x=>x.phase===e.phase && x.sourceProgramId===e.sourceProgramId && x.name===e.name);return {slot:e.id,name:e.name,sourceKey:e.sourceKey,previous:prev?{combinedClass:prev.combinedClass,dose:prev.dose}:null,currentDose:e.dose,reason:context(e.job??e.rawCoaching,e,entries,force),nextCriterion:'Actual controlled completion at the stated range/tempo/reserve and satisfactory recovery; change one relevant load/lever variable, otherwise hold or reduce.',actualLoad:null}})
for (const e of entries) e.combinedClass=n
const session={n,title:lesson.title,effort:lesson.effort,minutes,delivery,preparation:prepare,setup,quality,explosiveNotes:lesson.brief,progression,phaseNotes,connections,counts:{explosive:6,resilience:2,primary:6},equipment:[...new Set(entries.flatMap(e=>e.equipment))].filter(x=>x!=='Bodyweight'),exercises:entries.map(e=>({id:e.id,name:e.name,sourceName:e.sourceName,dose:e.dose,prescription:e.dose,rest:e.rest,purpose:context(e.job??e.rawCoaching,e,entries,force),description:e.coaching,instruction:e.coaching,preparation:e.preparation?.text??null,equipment:e.equipment,sourceTrack:e.sourceTrack,sourceProgram:e.sourceProgramId,sourceClass:e.sourceClass,sourceExerciseId:e.sourceExerciseId}))}
const suffix=String(n).padStart(2,'0')
const rows=es=>['| # | Exercise | Sets × reps | Specific job in this workout |','|---|---|---|---|',...es.map(e=>`| ${e.id} | **${e.name}** | **${e.dose}** | ${e.coaching.replaceAll('|','/')} **Recovery:** ${e.rest.replace(/\.+$/, '')}. **Source:** [${e.sourceReference}](../../${e.sourcePath}).${e.doseAdjustment?' **Combined dose:** '+e.doseAdjustment:''} |`)].join('\n')
let md=`# Full Body Force Generation — Class ${n} of 36\n\n**Stage ${stage}, lesson ${'ABC'[variant]}: ${lesson.title}**\n\n**Primary effort:** ${lesson.effort}\n\n**Baseline:** Ages 12–14 with established lifting/landing technique, individually qualified ballistic/kicking skill and supervision. All athlete execution, load and recovery remain unreported.\n\n**Daily stimulus brief:** ${lesson.brief}\n\n**Quality marker:** ${quality}\n\n**Connections:**\n\n${connections.map(c=>`- **${c.slots.join(' + ')} — ${c.title}:** ${c.cue}`).join('\n')}\n\n## 1. Access & Prepare 1\n\n${prepare}\n`
for(const [phase,heading,es]of[['E','2. Explosiveness — Exactly 6 Exercises',E],['S','3. Strength (Stabilization/Resilience) — Exactly 2 Exercises',S],['P','4. Strength (Primary) — Exactly 6 Exercises',P]])md+=`\n## ${heading}\n\n${phaseNotes[phase].join('\n\n')}\n\n${rows(es)}\n`
md+=`\n**Preparation sets, separate from working:**\n\n${P.map(e=>`- **${e.id} — ${e.name}:** ${e.preparation.text}`).join('\n')}\n\n**Workload:** ${work}\n\n**Delivery and timing:** ${delivery}\n\n**Setup:** ${setup}\n\n**Progression note:** ${progression}\n\n**Audit summary:** ${auditFindings} See [class audit](../audits/class_${suffix}_audit.md), [workload](../workload_class_${suffix}.json) and [stage coverage](../source_coverage.json).\n\n**Handoff:** ${n<36?`Review actual delivery and this saved workload before Class ${n+1}; develop its complementary job without assuming these prescriptions were performed.`:'All 36 classes are authored. Review actual matched output, loads, technical reserve, substitutions and recovery before selecting the next cycle; do not create Class 37 automatically.'}\n`
assert.equal((md.match(/^\| [ESP]\d \|/gm)??[]).length,14)
const coverage=entries.filter(e=>e.isOriginalCoverage).map(e=>e.sourceKey)
assert.equal(coverage.length,variant===2?8:10)
const allCovered=[...prior.flatMap(d=>d.source_coverage),...coverage]
assert.equal(new Set(allCovered).size,allCovered.length,'Original coverage must never double-count added support repeats')
const expectedCoverage=Object.values(force).flatMap(sessions=>sessions.flatMap(s=>s.exercises.map(e=>e.sourceKey)))
const missingCoverage=expectedCoverage.filter(key=>!allCovered.includes(key))
if(variant===2) assert.equal(missingCoverage.filter(key=>Number(key.split(':')[1])===stage).length,0,'Every original force entry in this stage is retained before advancing')
const data={class_number:n,stage,lesson:'ABC'[variant],title:lesson.title,effort:lesson.effort,brief:lesson.brief,reviewed_source_hashes:reviewedHashes,source_force_hashes:{upper:force['upper-body-force'][stage-1].sourceHashes,lower:force['lower-body-force'][stage-1].sourceHashes},entries,summary,timing,connections,progression,audit_findings:auditFindings,strength_trace:strengthTrace,source_coverage:coverage,session,actual_observations:null}
const audit=`# Full Body Force Generation — Class ${n} audit\n\n**Source review before design:** ${reviewed.join(', ')}. Their original review hashes are in the workload record; later append-only state changes do not rewrite history. Four original athlete feedback records remain unknown.\n\n**Specific decision:** ${lesson.brief}\n\n**Findings:** ${auditFindings}\n\n**Previous → current → reason → next criterion:** ${progression}\n\n## Prescribed workload and clock\n\n${work}\n\n| Timing component | Seconds |\n|---|---:|\n| Explosive work/resets/side/set rests and transitions, including E6→S1 | ${timing.explosive_seconds} |\n| Light work/recovery and transitions, including S2→P1 preparation | ${timing.resilience_seconds} |\n| Primary work, same-lift preparation and five new-order transitions | ${timing.primary_seconds} |\n| Additional instruction/setup | 720–1080 |\n\n${delivery}\n\n## Identity, dose and uniqueness\n\n| Combined slot | Original source | Dose decision | Previous same explosive execution |\n|---|---|---|---|\n${entries.map(e=>{const earlier=e.phase==='E'?[...prior].reverse().find(d=>d.entries.some(x=>x.phase==='E'&&explosiveIdentity(x)===explosiveIdentity(e))):null;return `| ${e.id} — ${e.name} | ${e.sourceReference} | ${e.isOriginalCoverage?'Retained original force dose':e.doseAdjustment??'Added repeat of original light-support dose'}; now ${e.dose} | ${e.phase==='E'?(earlier?`Class ${earlier.class_number}; retain for this source-stage job or matched review`:'First combined placement; original family/variant already exists'): 'Strength recurrence traced separately'} |`}).join('\n')}\n\n**Source-coaching adaptation:** Force source instructions and original doses remain in the workload provenance. Cross-row references are contextualized and next-exercise recovery is recalculated after reordering. Legacy upper Class 1 has declared movement-time estimates and explicit replacements; complete source rows remain accessible. Preparation uses complete lift tempos where an older source clock underallocated active time. New rotation doses use reviewed combined cues so old source totals/rest pointers cannot prescribe extra repetitions.\n\n**Recovery and workload judgment:** Main practice comes first. The additional rotation has no flight and small per-side exposure; broad/hand paired contacts remain separated by the curated source split. Primary sets remain challenging, not maximal, and no shared waiting period is counted twice. Neither a low event count nor the summed clock establishes suitability.\n\n${setup}\n\n**Checklist:** Exact seven-category mapping; existing preparation-only reference; four ordered sections; 6/2/6 meaningful rows; original force coverage; both rotational regions every class; distinct jobs; side/cycle/event arithmetic; explicit working/preparation recovery; timing recalculated; substitutions coordinated; no presumed performance; class saved before the next.\n`
validateFullBodyForceClass(data,md)
save('source_coverage.json',{status:n===36?'all original source entries covered':'partial while authoring',expected_original_entries:336,covered_original_entries:allCovered.length,covered:allCovered,missing:missingCoverage,actual_athlete_completion:null});
save(`classes/class_${suffix}.md`,md);save(`workload_class_${suffix}.json`,data);save(`audits/class_${suffix}_audit.md`,audit)
append('progression_ledger.md',`\n## Class ${n} — ${lesson.title}\n\n${work}\n\n${progression}\n\nEstimated ${minutes.join('–')} minutes after existing preparation. Actual delivery unknown.\n`)
append('drill_usage.md',`\n## Class ${n}\n\n| Slot / exercise | Source and decision |\n|---|---|\n${E.map(e=>`| ${e.id} — ${e.name} | ${e.sourceReference}; ${e.dose}; ${e.doseAdjustment??e.noveltyReason??'Retained source prescription; new placement is not a new drill.'} |`).join('\n')}\n`)
append('strength_progressions.md',`\n## Class ${n}\n\n| Slot / exercise | Previous → current | Reason / next criterion |\n|---|---|---|\n${strengthTrace.map(t=>`| ${t.slot} — ${t.name} | ${t.previous?`Class ${t.previous.combinedClass}: ${t.previous.dose}`:'First combined strength execution'} → ${t.currentDose} | ${t.reason} ${t.nextCriterion} |`).join('\n')}\n`)
state.last_finalized_class=n;state.next_class=n<36?n+1:null;state.finalized_file_paths.push(`classes/class_${suffix}.md`);state.workload_files.push(`workload_class_${suffix}.json`);state.audit_files.push(`audits/class_${suffix}_audit.md`);state.next_job=n<36?`Review Class ${n}, saved source coverage, current progression/drill/strength ledgers and actual feedback before designing Class ${n+1}. No performed work is inferred.`:'All 36 classes individually saved; complete the full-sequence/coverage audit and collection verification before marking the program complete.';save('progress.json',state)
append('curriculum.md',`\n**Class ${n} saved:** ${lesson.title}. ${summary.primary_bouts} primary bouts; ${minutes.join('–')} minutes after existing preparation. ${n<36?`Next: Class ${n+1}, conditional on source/actual response review.`:'Next: full-sequence audit and handoff.'}\n`)
console.log(JSON.stringify({saved:n,stage,title:lesson.title,originalEntries:coverage.length,events:{nonrotationalReleases:summary.explosive_events.nonrotational_ball_releases,rotationalReleases:summary.explosive_events.rotational_ball_releases,footLandings:summary.explosive_events.bilateral_landings+summary.explosive_events.unilateral_landings,handLandings:summary.explosive_events.bilateral_hand_landing_events},primaryBouts:summary.primary_bouts,primaryReps:summary.primary_reps,walkoutCycles:summary.primary_walkout_cycles,minutes}))
