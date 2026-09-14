const tracks = {
  'rotation-upper': { title: 'Upper body', folder: 'rotational_explosiveness_upper_body' },
  'rotation-lower': { title: 'Lower body', folder: 'rotational_explosiveness_lower_body' },
}
const phaseCounts = { E: 6, S: 2, P: 6 }
const releaseIds = ['123456', '45', '125', '145', '125', '23', '1234', '134', '1235', '135', '1236', '1234']
// Landings per attempt, not an equivalent-contact score. Linked drills contain
// two landings; the bounce-start kick includes one landing and one grounded kick.
const landingFactors = [
  { E3: 1, E4: 1 }, { E1: 1, E3: 1, E4: 1 }, { E1: 1, E3: 1 },
  { E3: 1, E6: 1 }, { E1: 1, E3: 1 }, { E3: 1 },
  { E1: 2, E2: 1, E6: 2 }, { E1: 1, E3: 1 }, { E1: 1, E3: 2, E6: 1 },
  { E3: 1, E6: 1 }, { E1: 1, E3: 1 }, { E3: 1 },
]
const clean = value => value.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
const displayName = name => name.replace(/\s*\[Proposed addition\/variant\]/g, '').replace(/ — primary anchor/g, '')
const normalizeReferences = text => text.replace(/before E\d+/g, 'before the next exercise')
  .replace(/Finish after this working set; no finisher\./g, 'Complete the working set without adding a finisher.')
  .replace(/ after fast rows/g, '')
const count = exercise => {
  const dose = exercise.dose.match(/^(\d+) × (\d+)/)
  if (!dose) throw new Error(`Unrecognized rotation dose: ${exercise.name}`)
  return Number(dose[1]) * Number(dose[2]) * (/Calf Raise/.test(exercise.name) || exercise.name === 'Landmine Rotation' ? 1 : 2)
}

const setup = 'Use the existing separate 10 m lanes. Keep waiting athletes outside the swept-leg, landing and ball paths. For released balls, verify a light grippable implement, permitted low floor target about 2–3 m beyond release, and containment of the entire flight/rebound/roll; use a throwing wall only after verification. Use a non-rebounding slam ball for slams. Clear the area between the leg drill and hand drill of each pair. Pairing is a coaching connection, not simultaneous stations or a throw immediately after a jump. Secure band/rope anchors and the landmine base. Kicks stay below hip height with a soft terminal knee, active recoil and no contact or spinning kick. Handoffs are controlled: secure the grip and wait for the feeder to release and step clear before turning. No new airborne-feed progression is added.'
const preparation = 'Complete the existing predetermined Access & Prepare 1 unchanged; do not recreate it or assign an assumed duration. Review its actual demands before this full-body class. Check the written setup and readiness of the selected kick, landing, handoff and implement tasks.'
const delivery = 'Plan one integrated class per week. Complete Access & Prepare 1 → six explosive exercises → two light resilience exercises → six primary-strength exercises. In each explosive pair, complete the lower-body exercise with its prescribed recovery, clear/reset the space, then complete the connected upper-body exercise. Each exercise has its own sets and rest; this is not a superset, continuous kick/throw combination or fatigue circuit. Preserve both-side doses and the longer of the row recovery and the source class’s between-exercise recovery. Allow 10–15 s between upper-body attempts, normally 20 s between lower-body attempts and 60 s for the early-cue lower-body tasks. Extend recovery when quality requires. Primary easy loading sets are separate from working reps. Confirm combined class duration from the selected doses, rest, preparation and actual group flow; original whole-course class durations cannot simply be added or reused. Review other sport/gym/tumbling work and the source roughly 48–72 h planning allowance from comparable demanding exposures. Resume missed classes in sequence instead of doubling up.'

function equipmentFor(source, ref) {
  const equipment = []
  const name = source.name.toLowerCase()
  const release = ref.programId === 'rotation-upper' && ref.sourceId[0] === 'E' && releaseIds[ref.sourceClass - 1].includes(ref.sourceId.slice(1))
  if (/slam/.test(name)) equipment.push('Slam ball')
  else if (release || /med ball|medicine.ball/.test(name)) equipment.push('Medicine ball')
  if (/band|pallof/.test(name)) equipment.push('Bands')
  if (/dumbbell/.test(name)) equipment.push('Dumbbells')
  if (/landmine/.test(name)) equipment.push('Landmine')
  if (/rope/.test(name)) equipment.push('Battle rope')
  if (/supported|seated|hip airplane/.test(name) || /bench/.test(source.dose)) equipment.push('Bench')
  if (ref.sourceId[0] === 'E') equipment.push('Marked space')
  return equipment.length ? equipment : ['Bodyweight']
}

function loadPreparation(ref, name) {
  if (ref.id[0] !== 'P') return null
  const reps = ref.programId === 'rotation-lower'
    ? { P1: '4 per side', P2: '3 per side', P3: '3 per side', P4: '4 per side', P5: '3 per side', P6: '5 bilateral' }[ref.sourceId]
    : name === 'Landmine Rotation' ? '4 alternating traverses total' : '3 per side'
  return `One easy set of ${reps} with bodyweight or lighter resistance before this lift, separate from working reps. Allow 30–45 s between preparation sides where applicable and 60–90 s before working. Add and record any further ramps and their time. Keep 2–3 clean repetitions in reserve during working sets; qualify each athlete’s current load rather than automatically increasing it.`
}

function recoveryFor(source, ref) {
  if (ref.id[0] === 'E') {
    if (ref.programId === 'rotation-lower') return `${ref.sourceClass === 10 ? 60 : 20} s between attempts; 60–90 s between sides/rounds`
    const seconds = source.description.match(/Rest (\d+) s between side bouts/)?.[1] ?? (ref.sourceId === 'E1' ? 90 : 60)
    return `10–15 s between reps; ${seconds} s between side bouts/sets`
  }
  if (ref.id[0] === 'S') return '30–45 s between sides; 45–60 s before next exercise'
  const explicit = source.dose.match(/Rest\s+[^.!]+/i)?.[0]
  if (explicit) return clean(explicit)
  return source.name === 'Landmine Rotation' ? '2–3 min between working sets/exercises'
    : /Calf Raise/.test(source.name) ? '90 s between sets; 60 s before next exercise'
    : '90 s between sides/exercises; 2 min between rounds'
}

export function buildRotationalFullBody(programs, plan) {
  if (plan.version !== 2 || plan.weeks !== 36 || plan.classesPerWeek !== 1 || plan.sequence.length !== 36) throw new Error('Full-body rotation requires 36 integrated weekly classes')
  const seen = new Set()
  const sessions = plan.sequence.map((lesson, index) => {
    if (lesson.week !== index + 1 || lesson.stage !== Math.floor(index / 3) + 1) throw new Error('Rotation sequence is out of order')
    if (lesson.role !== (index % 3 === 2 ? 'application' : 'integration')) throw new Error('Each rotation stage requires two integrated lessons and one added application')
    if (lesson.references.length !== 14 || new Set(lesson.references.map(r => r.id)).size !== 14) throw new Error(`Class ${lesson.week} needs 14 unique slots`)
    if (lesson.pairings.length !== 3 || !lesson.extension) throw new Error(`Class ${lesson.week} needs explicit connections and a development purpose`)
    for (const [phase, required] of Object.entries(phaseCounts)) {
      for (const programId of Object.keys(tracks)) {
        if (lesson.references.filter(ref => ref.id[0] === phase && ref.programId === programId).length !== required / 2) throw new Error(`Class ${lesson.week} is not balanced across both regions`)
      }
    }
    for (const [pairIndex, pair] of lesson.pairings.entries()) {
      const expected = [`E${pairIndex * 2 + 1}`, `E${pairIndex * 2 + 2}`]
      if (pair.slots.join() !== expected.join() || !pair.cue || !pair.title) throw new Error(`Class ${lesson.week} has an incomplete mechanical bridge`)
      if (lesson.references.find(r => r.id === expected[0])?.programId !== 'rotation-lower' || lesson.references.find(r => r.id === expected[1])?.programId !== 'rotation-upper') throw new Error(`Class ${lesson.week} must connect lower and upper work within each pair`)
    }
    const exercises = lesson.references.map(ref => {
      const source = programs[ref.programId]?.[ref.sourceClass - 1]?.exercises.find(e => e.id === ref.sourceId)
      if (!source) throw new Error(`Missing rotation source ${JSON.stringify(ref)}`)
      const key = `${ref.programId}:${ref.sourceClass}:${ref.sourceId}`
      if (lesson.role === 'integration' && ref.sourceClass !== lesson.stage) throw new Error('Integrated lessons must follow the source stage progression')
      if (lesson.role === 'application' && !seen.has(key)) throw new Error(`Application class ${lesson.week} uses a task not introduced in its integrated lessons`)
      seen.add(key)
      const pair = lesson.pairings.find(pair => pair.slots.includes(ref.id))
      const context = text => normalizeReferences(text).replace(/\b([ESP]\d+)\b/g, (id) => {
        const selected = lesson.references.find(other => other.programId === ref.programId && other.sourceClass === ref.sourceClass && other.sourceId === id)
        return selected?.id ?? `source ${id}`
      }).replace(/\bClass (\d+)\b/g, 'source Class $1')
      let instruction = context(source.instruction)
      if (ref.programId === 'rotation-upper' && ref.sourceClass === 7 && ref.sourceId === 'E1') instruction = instruction.replace('Under the optional gentle-feed condition, cushion the ball near the same hip before turning. ', '')
      const bridge = pair ? `${pair.title}: ${pair.cue}` : ref.id[0] === 'S'
        ? 'Support the shared rotational base with light control work; preserve primary-strength freshness.'
        : 'Support today’s leg-to-trunk-to-hand force transfer with this challenging strength pattern.'
      const dose = context(source.dose)
      return {
        ...source, id: ref.id, name: displayName(source.name), sourceName: source.name,
        dose, prescription: clean(dose.split(';')[0].split('. ')[0]),
        rest: recoveryFor(source, ref), instruction: `${bridge} ${instruction}`,
        purpose: bridge, description: `${bridge} ${instruction}`,
        preparation: loadPreparation(ref, source.name), equipment: equipmentFor(source, ref),
        sourceTrack: tracks[ref.programId].title, sourceProgram: ref.programId, sourceClass: ref.sourceClass, sourceExerciseId: ref.sourceId,
      }
    })
    const quality = lesson.week === 36
      ? 'Compare with Week 3 only when equipment, ball mass, target, stance, turn range, pair order, doses and recovery match. Observe scheduled attempts only. Log the actual variant, valid attempts on each side and a balanced finish; changed conditions create a new reference rather than evidence of improvement.'
      : `Within the scheduled attempts, record each side’s support-foot release, hip-led initiation and controlled finish. Use today’s three connections to identify whether a miss begins at support, transfer or endpoint. ${lesson.role === 'application' ? lesson.extension : 'Different drills are not equivalent force tests; use observed control and recovery to choose the next appropriate demand.'}`
    const explosive = exercises.filter(e => e.id[0] === 'E')
    const workload = {
      upperFastActions: explosive.filter(e => e.sourceProgram === 'rotation-upper').reduce((sum, e) => sum + count(e), 0),
      lowerAttempts: explosive.filter(e => e.sourceProgram === 'rotation-lower').reduce((sum, e) => sum + count(e), 0),
      ballReleases: explosive.filter(e => e.sourceProgram === 'rotation-upper' && releaseIds[e.sourceClass - 1].includes(e.sourceExerciseId.slice(1))).reduce((sum, e) => sum + count(e), 0),
      plannedLandings: explosive.filter(e => e.sourceProgram === 'rotation-lower').reduce((sum, e) => sum + count(e) * (landingFactors[e.sourceClass - 1][e.sourceExerciseId] ?? 0), 0),
      primaryWorkingReps: exercises.filter(e => e.id[0] === 'P').reduce((sum, e) => sum + count(e), 0),
    }
    return {
      n: lesson.week, stage: lesson.stage, classRole: lesson.role, title: `Full body · ${lesson.title}`,
      effort: lesson.effort, extension: lesson.extension, connections: lesson.pairings,
      minutes: null, delivery, preparation, setup, quality, exercises, workload,
      equipment: [...new Set(exercises.flatMap(e => e.equipment))].filter(e => e !== 'Bodyweight'),
      explosiveNotes: lesson.pairings.map(pair => `${pair.slots.join('/')} ${pair.title}: ${pair.cue}`).join(' '),
      progression: `${lesson.extension} Review actual attendance, technique, loads, soreness and other training. Change one demand only after clean execution at the intended reserve and acceptable recovery; otherwise hold or regress. No athlete completion, readiness or improvement is inferred from a class number.`,
      phaseNotes: {
        E: [lesson.extension, 'Each bridge connects two separately coached exercises. Complete all prescribed work and recovery for the first, then clear/reset the area for the second. Never combine a jump or kick with a simultaneous throw. Use the source’s shorter-range, supported, stationary or paused replacement inside the same slot. For handoffs, secure grip and wait for the feeder to step clear; use the existing self-held replacement when needed.'],
        S: ['One upper-body/trunk and one hip/foot resilience exercise connect control at both ends of the rotational chain. Keep at least 4–5 clean repetitions or about 5 seconds of a sound hold in reserve. Preserve the row’s within-hold relaxation and use the stated side/exercise recovery.'],
        P: ['Three lower-body and three upper-body/trunk lifts support the class’s force-transfer purpose. Across the first two classes of each stage, every original primary-strength prescription is included once; the additional day selects complementary full-body strength. Perform the listed easy preparation for each lift, with its recovery, before working. Keep 2–3 clean reps in reserve and the source controlled return tempo.'],
      },
      counts: { explosive: 6, resilience: 2, primary: 6 },
    }
  })
  for (let stage = 1; stage <= 12; stage++) {
    const integrated = sessions.filter(s => s.stage === stage && s.classRole === 'integration').flatMap(s => s.exercises)
    for (const programId of Object.keys(tracks)) {
      const ids = integrated.filter(e => e.sourceProgram === programId).map(e => e.sourceExerciseId).sort()
      const expected = programs[programId][stage - 1].exercises.map(e => e.id).sort()
      if (ids.join() !== expected.join()) throw new Error(`Stage ${stage} drops or duplicates source work from ${programId}`)
    }
  }
  return sessions
}

export function rotationalClassMarkdown(session) {
  const lines = [
    `# Rotational Force: Full Body — Week ${session.n} / Class ${session.n} of 36`, '',
    `**Lesson:** ${session.title}. Stage ${session.stage}; ${session.classRole === 'application' ? 'additional application day' : 'integrated source lesson'}.`, '',
    `**Primary effort:** ${session.effort}`, '', `**Development purpose:** ${session.extension}`, '',
    `**Quality marker:** ${session.quality}`, '', `**Delivery and timing:** ${session.delivery}`, '',
    '## How this class connects', '',
    ...session.connections.map(pair => `- **${pair.slots.join(' + ')} — ${pair.title}:** ${pair.cue}`), '',
    '## 1. Access & Prepare 1', '', session.preparation, '',
  ]
  for (const [phase, heading] of [['E','2. Explosiveness'], ['S','3. Strength (Stabilization/Resilience)'], ['P','4. Strength (Primary)']]) {
    lines.push(`## ${heading}`, '', ...session.phaseNotes[phase].flatMap(note => [note, '']), '| Slot | Exercise | Dose | Recovery | Equipment |', '|---|---|---|---|---|')
    for (const e of session.exercises.filter(e => e.id[0] === phase)) lines.push(`| ${e.id} | ${e.name} | ${e.dose.replaceAll('|', '/')} | ${e.rest} | ${e.equipment.join('; ')} |`)
    lines.push('')
    for (const e of session.exercises.filter(e => e.id[0] === phase)) {
      const sourceLink = `../../${tracks[e.sourceProgram].folder}/classes/class_${String(e.sourceClass).padStart(2, '0')}.md`
      lines.push(`### ${e.id} — ${e.name}`, '', `**Connection and coaching:** ${e.instruction}`, '')
      if (e.preparation) lines.push(`**Load preparation:** ${e.preparation}`, '')
      lines.push(`**Source:** [${e.sourceTrack} · Class ${e.sourceClass} · ${e.sourceExerciseId}](${sourceLink}). Source class labels describe the original lesson, not today’s ordering.`, '')
    }
  }
  const w = session.workload
  lines.push('## Setup and delivery', '', session.setup, '', '## Workload and progression', '',
    `${w.upperFastActions} upper-body fast actions, including ${w.ballReleases} ball releases; ${w.lowerAttempts} lower-body attempts, containing ${w.plannedLandings} planned landings; ${w.primaryWorkingReps} primary working reps plus the separate easy loading sets. Landings and releases are task-specific counts, not equivalent exposure units; linked drills can contain multiple contacts per attempt. Count attempted work, substitutions and unintended additional contacts.`, '',
    session.progression, '', 'This is a draft for ages 12–14 with the original lifting/landing prerequisites and qualified coaching. Actual athlete completion and response remain unreported.', '',
    'Generated from the curated sequence.json and the original upper/lower class markdown. Edit those sources, then rebuild the accelerator data and these class documents.', '')
  return lines.join('\n')
}

export function rotationalReadme(sessions) {
  return [
    '# Rotational Force: Full Body — 36 Classes', '',
    '**Draft schedule: 36 weeks, one class per week. Every class integrates upper and lower body rotational force generation.**', '',
    'The original 12 upper-body and 12 lower-body courses supply the exercises. Their material is reorganized into **24 integrated classes**, with **12 additional application days** that build on those lessons: 36 full-body classes in total. No class is an unchanged upper-only or lower-only course day.', '',
    '## How the plan develops', '',
    'Each three-week stage contains two integrated lessons followed by an application day. Every class has the existing Access & Prepare 1, six explosive exercises (three lower, three upper), two light resilience exercises (one from each region), and six primary-strength exercises (three from each region). The first two lessons together use every exercise prescription from the corresponding source classes once. The application day recombines already introduced tasks around a specific control, entry, receiving or review problem.', '',
    'The explosive work follows three explicit mechanical connections. For example, a grounded pivot establishes the support-foot action used in the scoop; a low kick and shot-put share a freely turning support base; a controlled catch or leg recovery establishes the base needed for a hand impulse. These are individually coached drills with full recovery and a cleared area between them, not simultaneous kick/throw combinations or conditioning supersets. Connection cues are shown directly in the coach portal and in every class document.', '',
    '| Weeks | Development emphasis |', '|---|---|',
    '| 1–9 | Build foot-led initiation, support transfer and controlled finishes; distinguish held starts from preloads. |',
    '| 10–15 | Apply the links to recoil, entry steps, lateral arrival, braking and recovery. |',
    '| 16–18 | Consolidate both regions in every class. All primary lifts use one working set; Week 18 has 24 explosive attempts, four ball releases and no planned landings. |',
    '| 19–27 | Organize controlled handoffs and grounded preloads; connect forward, diagonal and retreating work to a usable support base. |',
    '| 28–33 | Preserve support and endpoints with early lower-body cues, planned upper-body references and precise output lines. |',
    '| 34–36 | Review source foundations inside integrated lessons, then repeat Week 3’s full-body reference under matched conditions. |', '',
    '## Weekly class map', '', '| Week / class | Role | Integrated lesson |', '|---|---|---|',
    ...sessions.map(s => `| ${s.n} | ${s.classRole === 'application' ? 'Additional application' : 'Integrated lesson'} | [${s.title}](classes/class_${String(s.n).padStart(2, '0')}.md) |`), '',
    '## What the twelve added days add', '',
    ...sessions.filter(s => s.classRole === 'application').map(s => `- **Week ${s.n} — ${s.title}:** ${s.extension}`), '',
    '## Coaching and loading', '', preparation, '', setup, '', delivery, '',
    'Retain the source working doses, technical reserve, safe execution and same-slot substitutions. Each selected primary lift includes its easy preparation dose. Counts are prescribed rather than observed; actual readiness and recovery determine delivery. Pairing does not justify more load, shorter recovery or a larger movement. Source class numbers identify exercise provenance, not the new weekly schedule. Full group duration remains to be established from the combined work and actual preparation/queues.', '',
    '## Prescribed workload ledger', '', '| Week | Upper fast actions | Ball releases (subset) | Lower attempts | Planned landings | Primary working reps |', '|---|---:|---:|---:|---:|---:|',
    ...sessions.map(s => `| ${s.n} | ${s.workload.upperFastActions} | ${s.workload.ballReleases} | ${s.workload.lowerAttempts} | ${s.workload.plannedLandings} | ${s.workload.primaryWorkingReps} |`), '',
    'Counts represent different tasks and must not be added as an equivalent-contact safety score. Linked drills can have multiple landings per attempt. Log failed attempts, changed variants, extra contacts and additional loading sets.', '',
    '## Source and verification', '',
    'The coach portal card remains **Rotational Force: Full Body 36 Classes**, in Athleticism Accelerator. Its description explicitly highlights upper and lower body rotational force generation in every class.', '',
    '[sequence.json](sequence.json) is the curated source for all 36 lessons, their mechanical connections and their exercise references. The existing [upper-body](../rotational_explosiveness_upper_body/README.md) and [lower-body](../rotational_explosiveness_lower_body/README.md) class documents supply the prescriptions. All 36 class documents here and the portal data are generated from those sources; no original course file is changed.', '',
    'Rebuild with `node scripts/build-athleticism-accelerator.mjs`. Check generated parity with `node scripts/build-athleticism-accelerator.mjs --check` and audit integration with `node --test scripts/verify-rotational-full-body.mjs`.', '',
  ].join('\n')
}
