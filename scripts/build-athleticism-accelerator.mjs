import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildSpeedAgility, speedAgilityCurriculum } from './lib/build-speed-agility.mjs'
import { buildRotationalFullBody, rotationalClassMarkdown, rotationalReadme } from './lib/build-rotational-full-body.mjs'
import { enrichUpperBodyForceSession } from './lib/build-upper-body-force.mjs'
import { enrichLowerBodyForceSession } from './lib/build-lower-body-force.mjs'
import { buildFullBodyForce } from './lib/build-full-body-force.mjs'
import {
  acceleratorExerciseKey,
  associationMap,
} from './lib/accelerator-exercise-library.mjs'

// The finalized curriculum markdown remains the source of truth. This script
// creates a compact read model for the coach-facing daily-plan view.
const programs = [
  ['distance-running', 'protracted_running'],
  ['sprinting', 'sprinting'],
  ['jumps-horizontal', 'horizontal_jumps'],
  ['jumps-vertical', 'vertical_jumps'],
  ['jumps-rebound', 'jumps_force_absorption_elastic_rebound'],
  ['agility-mobility', 'agility_directional'],
  ['agility-reactive', 'agility_reactive_anticipation'],
  ['upper-body-force', 'upper_body_force_generation'],
  ['lower-body-force', 'lower_body_force_generation'],
  ['rotation-upper', 'rotational_explosiveness_upper_body'],
  ['rotation-lower', 'rotational_explosiveness_lower_body'],
]
const root = new URL('../workout_plan/', import.meta.url)
const target = new URL('../src/coach/data/acceleratorPrograms.json', import.meta.url)
const libraryManifest = JSON.parse(readFileSync(new URL('./data/athleticism-accelerator-library-manifest.json', import.meta.url), 'utf8'))
const libraryAssociations = associationMap(libraryManifest)
const plain = (value = '') => value.replace(/\*\*/g, '').replace(/\[(.*?)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim()
const short = (value, length = 78) => value.length <= length ? value : `${value.slice(0, length).replace(/\s+\S*$/, '')}…`
const unique = (items) => [...new Set(items)]

function dailyClassTitle(markdown, n) {
  const primaryEffort = plain(markdown.match(/^\*\*Primary effort:\*\*\s*(.+)$/m)?.[1] ?? '')
  const title = (primaryEffort.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? primaryEffort).replace(/[.!?]$/, '')
  if (!title) throw new Error(`Class ${n} must define a Primary effort for its daily overview title`)
  return title
}

function equipmentFor(value) {
  const text = value.toLowerCase()
  const matches = []
  if (/slam ball/.test(text)) matches.push('Slam ball')
  else if (/medicine ball|med ball|\bball\b/.test(text)) matches.push('Medicine ball')
  if (/dumbbell/.test(text)) matches.push('Dumbbells')
  if (/kettlebell/.test(text)) matches.push('Kettlebell')
  if (/landmine/.test(text)) matches.push('Landmine')
  if (/band|pallof|loop/.test(text)) matches.push('Bands')
  if (/battle rope|\brope\b/.test(text)) matches.push('Battle rope')
  if (/bench/.test(text)) matches.push('Bench')
  if (/box|step/.test(text)) matches.push('Box / step')
  if (/cone|lane|wall|track/.test(text)) matches.push('Marked space')
  return matches.length ? matches : ['Bodyweight']
}

function restFor(dose, description) {
  const text = plain(`${dose} ${description}`)
  const match = text.match(/(?:rest|recover|pause|reset|relax|allow)\s+([^.!]*?(?:s|sec(?:onds)?|min(?:utes)?)[^.!]*)/i)
  return match ? short(match[0], 72) : 'See prescribed recovery'
}

function sections(markdown) {
  const result = {}
  const found = [...markdown.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)]
  found.forEach((match, index) => { result[match[1]] = markdown.slice(match.index + match[0].length, found[index + 1]?.index ?? markdown.length) })
  return result
}

function tableRows(section, phase) {
  return section.split('\n').flatMap((line) => {
    if (!/^\|\s*(?:[ESP]\d+|\d+)\s*\|/i.test(line)) return []
    const [, name = '', dose = '', description = '', equipment = '', recovery = ''] = line.split('|').slice(1, -1).map(plain)
    return [{ name, sourceName: name, dose, description,
      ...(equipment ? { equipment: equipment.split(';').map(plain) } : {}),
      ...(recovery ? { rest: recovery } : {}),
    }]
  }).map((entry, index) => ({
    ...entry, id: `${phase}${index + 1}`,
    prescription: short(entry.dose.split(';')[0], 100), rest: entry.rest ?? restFor(entry.dose, entry.description),
    purpose: short(entry.description, 220), instruction: entry.description, preparation: null,
    equipment: entry.equipment ?? equipmentFor(`${entry.name} ${entry.description}`),
  }))
}

function buildSession(source, n) {
  const markdown = readFileSync(new URL(`${source}/classes/class_${String(n).padStart(2, '0')}.md`, root), 'utf8')
  const part = sections(markdown)
  const exercises = [...tableRows(part['2'] ?? '', 'E'), ...tableRows(part['3'] ?? '', 'S'), ...tableRows(part['4'] ?? '', 'P')]
  const count = (phase) => exercises.filter((exercise) => exercise.id.startsWith(phase)).length
  if (count('E') !== 6 || count('S') !== 2 || count('P') !== 6) throw new Error(`${source} class ${n} must contain 6 explosive, 2 resilience and 6 primary exercises`)
  const effort = plain(markdown.match(/^\*\*Primary effort:\*\*\s*(.+)$/m)?.[1] ?? '')
  const delivery = plain(markdown.match(/^\*\*Delivery and timing:\*\*\s*(.+)$/m)?.[1] ?? '')
  const minuteMatch = delivery.match(/(\d+)\s*[–-]\s*(\d+)\s*minutes/i)
  const marker = markdown.match(/^\*\*(?:Integrated )?Quality marker:\*\*\s*(.+)$/m)
  const session = {
    n, title: dailyClassTitle(markdown, n), effort, minutes: minuteMatch ? [Number(minuteMatch[1]), Number(minuteMatch[2])] : null, delivery,
    equipment: unique(exercises.flatMap((exercise) => exercise.equipment)).filter((item) => item !== 'Bodyweight'), exercises,
    quality: plain(marker?.[1] ?? ''), preparation: plain(part['1'] ?? ''),
    explosiveNotes: short(plain((part['2'] ?? '').split('| # |')[0]), 520), counts: { explosive: 6, resilience: 2, primary: 6 },
  }
  if (source === 'lower_body_force_generation') return enrichLowerBodyForceSession(session, markdown, part, new URL(`${source}/`, root))
  return source === 'upper_body_force_generation'
    ? enrichUpperBodyForceSession(session, markdown, part, new URL(`${source}/`, root))
    : session
}

const output = Object.fromEntries(programs.map(([id, source]) => [id, Array.from({ length: 12 }, (_, index) => buildSession(source, index + 1))]))
const jumpTrackLabels = {
  'jumps-horizontal': 'Horizontal jumps',
  'jumps-vertical': 'Vertical jumps',
  'jumps-rebound': 'Force absorption & elastic rebound',
}
const jumpTracks = ['jumps-rebound', 'jumps-vertical', 'jumps-horizontal']
const resilienceRotation = [
  [['jumps-rebound', 0], ['jumps-vertical', 0]],
  [['jumps-horizontal', 0], ['jumps-rebound', 1]],
  [['jumps-vertical', 1], ['jumps-horizontal', 1]],
]
const integratedTitles = ['Control & project', 'Rebound & redirect', 'Consolidate every direction']

function integratedExercise(exercise, programId, sourceClass, phase, index) {
  return {
    ...exercise,
    id: `${phase}${index + 1}`,
    sourceTrack: jumpTrackLabels[programId],
    sourceClass,
    sourceExerciseId: exercise.id,
  }
}

function interleavePairs(sourceIndex, variantIndex, phase) {
  const rows = jumpTracks.map((programId) => ({
    programId,
    exercises: output[programId][sourceIndex].exercises
      .filter((exercise) => exercise.id.startsWith(phase))
      .slice(variantIndex * 2, variantIndex * 2 + 2),
  }))
  return [0, 1].flatMap((pairIndex) => rows.map(({ programId, exercises }) => ({ programId, exercise: exercises[pairIndex] })))
    .map(({ programId, exercise }, index) => integratedExercise(exercise, programId, sourceIndex + 1, phase, index))
}

output['jumps-max-air'] = Array.from({ length: 12 }, (_, sourceIndex) =>
  Array.from({ length: 3 }, (_, variantIndex) => {
    const explosive = interleavePairs(sourceIndex, variantIndex, 'E')
    const primary = interleavePairs(sourceIndex, variantIndex, 'P')
    const resilience = resilienceRotation[variantIndex].map(([programId, exerciseIndex], index) => {
      const exercise = output[programId][sourceIndex].exercises.filter((item) => item.id.startsWith('S'))[exerciseIndex]
      return integratedExercise(exercise, programId, sourceIndex + 1, 'S', index)
    })
    const sourceSessions = jumpTracks.map((programId) => output[programId][sourceIndex])
    const exercises = [...explosive, ...resilience, ...primary]
    return {
      n: sourceIndex * 3 + variantIndex + 1,
      title: `${integratedTitles[variantIndex]} · Stage ${sourceIndex + 1}${String.fromCharCode(65 + variantIndex)}`,
      effort: `Integrate force absorption, vertical projection, and horizontal projection using the existing Stage ${sourceIndex + 1} prescriptions. Each output and strength phase draws from all three jump tracks.`,
      minutes: null,
      delivery: 'Preserve every listed dose and recovery period. Confirm total delivery time, equipment flow, and athlete readiness for this integrated class before coaching it.',
      equipment: unique(exercises.flatMap((exercise) => exercise.equipment)).filter((item) => item !== 'Bodyweight'),
      exercises,
      quality: sourceSessions.map((session) => session.quality).filter(Boolean).join(' '),
      preparation: sourceSessions[0].preparation,
      explosiveNotes: 'Six explosive exercises are integrated in alternating order: two force-absorption and rebound selections, two vertical-jump selections, and two horizontal-jump selections. Preserve each exercise’s written quality and recovery rules.',
      counts: { explosive: 6, resilience: 2, primary: 6 },
    }
  }),
).flat()

for (let sourceIndex = 0; sourceIndex < 12; sourceIndex += 1) {
  const stage = output['jumps-max-air'].slice(sourceIndex * 3, sourceIndex * 3 + 3)
  for (const session of stage) {
    for (const phase of ['E', 'P']) {
      for (const programId of jumpTracks) {
        const trackCount = session.exercises.filter((exercise) => exercise.id.startsWith(phase) && exercise.sourceTrack === jumpTrackLabels[programId]).length
        if (trackCount !== 2) throw new Error(`Max Air class ${session.n} must include two ${phase} exercises from ${programId}`)
      }
    }
  }
  for (const phase of ['E', 'S', 'P']) {
    for (const programId of jumpTracks) {
      const sourceIds = output[programId][sourceIndex].exercises.filter((exercise) => exercise.id.startsWith(phase)).map((exercise) => exercise.id).sort()
      const integratedIds = stage.flatMap((session) => session.exercises)
        .filter((exercise) => exercise.id.startsWith(phase) && exercise.sourceTrack === jumpTrackLabels[programId])
        .map((exercise) => exercise.sourceExerciseId).sort()
      if (sourceIds.join(',') !== integratedIds.join(',')) throw new Error(`Max Air Stage ${sourceIndex + 1} does not preserve every ${phase} prescription from ${programId}`)
    }
  }
}

output['speed-agility'] = buildSpeedAgility(output)
const rotationPlan = JSON.parse(readFileSync(new URL('rotational_force_full_body/sequence.json', root), 'utf8'))
output['rotation-full-body'] = buildRotationalFullBody(output, rotationPlan)
output['full-body-force'] = buildFullBodyForce(root)

for (const [programId, sessions] of Object.entries(output)) {
  for (const session of sessions) {
    if (!session.title?.trim() || /^(?:Class|Week)\s+\d+\b/i.test(session.title)) {
      throw new Error(`${programId} Class ${session.n} must have a purpose-driven daily overview title without a class or week prefix`)
    }
    for (const exercise of [...(session.prepareExercises ?? []), ...session.exercises]) {
      const association = libraryAssociations.get(acceleratorExerciseKey(exercise.name))
      if (!association) {
        throw new Error(`Missing Exercise Library association for ${programId} Class ${session.n}: ${exercise.name}`)
      }
      exercise.librarySlug = association.librarySlug
    }
  }
}
mkdirSync(new URL('../src/coach/data/', import.meta.url), { recursive: true })
const content = `${JSON.stringify(output, null, 2)}\n`
const speedAgilityDraftTarget = new URL('speed_and_agility/curriculum.md', root)
const speedAgilityDraft = speedAgilityCurriculum(output['speed-agility'])
const rotationArtifacts = [
  ['README.md', rotationalReadme(output['rotation-full-body'])],
  ...output['rotation-full-body'].map(session => [`classes/class_${String(session.n).padStart(2, '0')}.md`, rotationalClassMarkdown(session)]),
]
for (const [path, content] of rotationArtifacts) {
  const file = new URL(`rotational_force_full_body/${path}`, root)
  if (process.argv.includes('--check')) {
    if (readFileSync(file, 'utf8') !== content) throw new Error(`Rotational draft ${path} is stale; rebuild the accelerator data`)
  } else writeFileSync(file, content)
}
if (process.argv.includes('--check')) {
  if (readFileSync(speedAgilityDraftTarget, 'utf8') !== speedAgilityDraft) throw new Error('Speed & Agility draft is stale; rebuild the accelerator data')
  if (readFileSync(target, 'utf8') !== content) throw new Error('Accelerator data is stale; run node scripts/build-athleticism-accelerator.mjs')
  const classCount = Object.values(output).reduce((total, sessions) => total + sessions.length, 0)
  console.log(`Verified ${Object.keys(output).length} programs / ${classCount} classes / ${classCount * 14} exercise prescriptions against curriculum source.`)
} else { writeFileSync(speedAgilityDraftTarget, speedAgilityDraft); writeFileSync(target, content); console.log(`Wrote ${fileURLToPath(target)}`) }
