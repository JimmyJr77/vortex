import { readFileSync } from 'node:fs'

const root = new URL('../../workout_plan/', import.meta.url)
export const speedAgilityTracks = {
  sprinting: { title: 'Sprinting & Acceleration', folder: 'sprinting' },
  'agility-mobility': { title: 'Agility: Mobility', folder: 'agility_directional' },
  'agility-reactive': { title: 'Agility: Reactive', folder: 'agility_reactive_anticipation' },
}
const variants = [
  { title: 'Push, brake & respond', intent: 'Connect the sprint push to a controlled planned stop or exit, then use that control to respond to a live opponent.' },
  { title: 'Redirect & pursue', intent: 'Link sprint mechanics and lateral force control to a planned change of direction, then read and follow a live movement.' },
  { title: 'Coordinate, read & reaccelerate', intent: 'Connect running coordination to a purposeful planned exit, then choose or adapt the next action from a live cue.' },
]
const resilience = [
  [['sprinting', 'S2'], ['agility-mobility', 'S2']],
  [['sprinting', 'S1'], ['agility-reactive', 'S2']],
  [['agility-mobility', 'S1'], ['agility-reactive', 'S1']],
]

export function buildSpeedAgility(programs) {
  const sequence = JSON.parse(readFileSync(new URL('speed_and_agility/sequence.json', root), 'utf8'))
  if (sequence.weeks !== 36 || sequence.classesPerWeek !== 1 || sequence.stages.length !== 12) throw new Error('Speed & Agility requires 12 stages / 36 weekly classes')
  return sequence.stages.flatMap((stage, stageIndex) => {
    if (stage.stage !== stageIndex + 1) throw new Error('Speed & Agility stages must progress from 1 to 12')
    const sourceSessions = Object.fromEntries(Object.keys(speedAgilityTracks).map((id) => [id, programs[id][stageIndex]]))
    function take(programId, exerciseId) {
      const exercise = sourceSessions[programId].exercises.find(({ id }) => id === exerciseId)
      if (!exercise) throw new Error(`Missing ${programId} class ${stage.stage} ${exerciseId}`)
      return { ...exercise, sourceTrack: speedAgilityTracks[programId].title, sourceProgram: programId, sourceClass: stage.stage, sourceExerciseId: exerciseId }
    }
    return variants.map((variant, variantIndex) => {
      const selections = Object.fromEntries(Object.keys(speedAgilityTracks).map((id) => [id, stage.explosive[id][variantIndex].map((exerciseId) => take(id, exerciseId))]))
      // Establish speed mechanics while fresh, link them to planned control, and
      // apply the same stage's movement demands to real perception/action work.
      const explosive = [
        selections.sprinting[0], selections.sprinting[1],
        ...selections['agility-mobility'],
        ...(variantIndex < 2 ? [...selections['agility-reactive']].reverse() : selections['agility-reactive']),
      ]
      const primary = Object.keys(speedAgilityTracks).flatMap((id) => stage.primary[id][variantIndex].map((exerciseId) => take(id, exerciseId)))
      const light = resilience[variantIndex].map(([id, exerciseId]) => {
        // Keep the pair complementary when source courses share foot-doming
        // or lateral step-down work under slightly different names.
        const replaceFootDuplicate = variantIndex === 1 && id === 'sprinting' && [1, 6, 12].includes(stage.stage)
        const replaceStepDownDuplicate = variantIndex === 2 && id === 'agility-reactive' && [1, 4, 6].includes(stage.stage)
        return take(id, replaceFootDuplicate || replaceStepDownDuplicate ? 'S2' : exerciseId)
      })
      const exercises = [['E', explosive], ['S', light], ['P', primary]].flatMap(([phase, rows]) => rows.map((exercise, index) => ({ ...exercise, id: `${phase}${index + 1}` })))
      return {
        n: stageIndex * 3 + variantIndex + 1,
        title: `${variant.title} · Stage ${stage.stage}${String.fromCharCode(65 + variantIndex)}`,
        stage: stage.stage,
        effort: `${stage.focus}. ${variant.intent}`,
        minutes: null,
        delivery: 'One integrated class per week. Complete Access & Prepare 1, then six explosive drills, two light resilience exercises and six primary-strength exercises. Keep each selected exercise’s dose, recovery, preparation sets and setup conditions from its source class. Confirm the combined timing and equipment flow; preserve full recovery between tasks and extend it if movement quality has not returned. Source labels identify the original exercise numbers, which may differ from today’s order.',
        equipment: [...new Set(exercises.flatMap(({ equipment }) => equipment))].filter((item) => item !== 'Bodyweight'),
        exercises,
        quality: `Within the scheduled efforts, observe the sprint anchor’s projection or upright coordination, the planned task’s braking and exit control, and the reactive anchor’s correct read and controlled response. ${stage.focus}. Record execution and recovery; do not add test attempts or infer gains from unlike drills.`,
        preparation: sourceSessions.sprinting.preparation,
        explosiveNotes: 'Two drills from each course share one purpose: produce speed, control direction, then respond to a live cue. The sprint and live-decision anchors recur across the stage’s three classes while the supporting drills vary. Each class includes a genuine reactive task; a drill’s course label alone does not make it reactive. Repeat the original doses only when readiness supports them; the class number does not authorize added volume or speed.',
        counts: { explosive: 6, resilience: 2, primary: 6 },
      }
    })
  })
}

export function speedAgilityCurriculum(sessions) {
  const lines = [
    '# Speed & Agility — 36-week integrated development plan',
    '',
    '**Draft schedule:** One coach-led class per week for 36 weeks. Every class integrates sprinting and acceleration, mobile agility and reactive agility. Ages 12–14, following the existing courses’ prerequisites.',
    '',
    '**Coach portal card:** Speed & Agility 36 Classes',
    '',
    '## How the courses work together',
    '',
    'Each class has two explosive drills from Sprinting & Acceleration, two from Agility: Mobility and two from Agility: Reactive. Start with the sprint mechanics or short acceleration anchor, connect it to planned braking and direction control, then apply the movement to a live decision. A genuine opponent/cue-response task is included every week. Agility: Mobility is the portal name for the existing directional-agility course.',
    '',
    'Twelve stages use the existing courses’ Class 1–12 material in order. Each stage spans three integrated weekly classes: Push, brake & respond; Redirect & pursue; Coordinate, read & reaccelerate. The sprint and live-decision anchors deliberately recur within the stage; supporting drills and strength selections change to develop the same skills in complementary ways. These are new combinations of existing exercises, not new drill prescriptions or concatenated course workouts.',
    '',
    'Keep the existing Access & Prepare 1. Each day then has exactly six explosive, two light resilience and six primary-strength exercises. The strength phase selects two exercises from each course, with complementary movement roles rather than multiple copies of the same lift. The two resilience selections rotate across courses. Original doses, recovery, coaching cues and source-class preparation/setup conditions remain attached to the selections.',
    '',
    '## Weekly classes',
    '',
    '| Week / class | Integrated focus | Stage emphasis |',
    '|---|---|---|',
    ...sessions.map((session) => `| ${session.n} | [${session.title}](#class-${session.n}) | ${session.effort} |`),
    '',
    '## Coaching the sequence',
    '',
    'Review technique, recovery and surrounding sport/gym work each week. Stage numbers do not authorize load increases. Use the original exercise’s regressions and count missed attempts within the planned allocation. Hold or resume the sequence when needed; do not double up missed classes. Holds and absences can extend the calendar beyond 36 weeks. Review delivered work after Class 36 before choosing another cycle.',
    '',
    'The source sprint course uses short starts and gym support for upright mechanics; it does not prescribe maximum-velocity running in the available space. Mobile-agility work includes planned braking, cuts and reacceleration. Reactive work couples movement to a live cue; the fixed-route drills and physical support exercises remain distinct from the decision task. Respect each drill’s stopping corridors, equipment and live-cue staffing requirements.',
    '',
    'The integrated class duration must be established from the selected doses, complete recovery, source-class load preparation, actual Access & Prepare 1 and group setup. Do not sum the three source-class duration estimates or compress recovery to fit one. Source links below retain original exercise identifiers, full instructions, preparation sets and between-exercise recovery context. Original labels in copied instructions refer to that linked source class.',
    '',
  ]
  for (const session of sessions) {
    lines.push(`<a id="class-${session.n}"></a>`, `### Class ${session.n}: ${session.title}`, '', session.effort, '', 'Complete the existing Access & Prepare 1, then follow the sequence below.', '', '| Slot | Existing exercise | Dose and recovery | Source lesson |', '|---|---|---|---|')
    for (const exercise of session.exercises) {
      const source = speedAgilityTracks[exercise.sourceProgram]
      const link = `../${source.folder}/classes/class_${String(exercise.sourceClass).padStart(2, '0')}.md`
      const safe = (text) => text.replaceAll('|', '\\|')
      lines.push(`| ${exercise.id} | ${safe(exercise.name)} | ${safe(exercise.dose)} | [${source.title} · Class ${exercise.sourceClass} · ${exercise.sourceExerciseId}](${link}) |`)
    }
    lines.push('')
  }
  lines.push('Generated from the existing course prescriptions and `sequence.json` by `node scripts/build-athleticism-accelerator.mjs`. Validate with `node scripts/build-athleticism-accelerator.mjs --check` and `node scripts/verify-speed-agility-program.mjs`.', '')
  return lines.join('\n')
}
