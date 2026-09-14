import { readFileSync } from 'node:fs'

const plain = (value = '') => value.replace(/\*\*/g, '').replace(/\[(.*?)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim()
const paragraphs = (text) => text.split(/\n\s*\n/).filter((block) => block.trim() && !block.trim().startsWith('|'))
const note = (markdown, label) => plain(markdown.split('\n').find((line) => line.startsWith(`**${label}`)) ?? '')
const unique = (items) => [...new Set(items)]

function equipmentFor(name, cue) {
  const items = []
  if (/slam/i.test(name)) items.push('Slam ball')
  else if (/medicine ball/i.test(name)) items.push('Medicine ball')
  if (/dumbbell|floor press|one-arm row/i.test(name)) items.push('Dumbbells')
  if (/landmine/i.test(name)) items.push('Landmine')
  if (/band|pallof/i.test(name)) items.push('Bands')
  if (/attachment|overhead anchor/i.test(cue)) items.push('Rated band attachment')
  if (/battle-rope/i.test(name)) items.push('Loose battle rope')
  if (/pull-up/i.test(name)) items.push('Pull-up bar', 'Box / step')
  if (/plyo push-up|bench/i.test(name) || /bench|supported.*row|hand\/knee supported/i.test(cue)) items.push('Bench')
  if (/wall power push-off/i.test(name)) items.push('Wall support')
  return unique(items.length ? items : ['Bodyweight'])
}

// Keep the complete markdown rows, plus the guidance that lives outside tables.
// The structured ledger supplies checked timing, side dosing and preparation.
export function enrichUpperBodyForceSession(session, markdown, parts, source) {
  const suffix = String(session.n).padStart(2, '0')
  const workload = JSON.parse(readFileSync(new URL(`workload_class_${suffix}.json`, source), 'utf8'))
  const isFirst = session.n === 1
  const entries = isFirst ? [] : [...workload.explosive, ...workload.resilience, ...workload.primary]
  const preparation = isFirst ? workload.primary_preparation_sets : workload.primary_preparation
  const tailLabels = /^(?:\*\*)?(?:Workload and timing|Timing and scheduling|Scheduling|Progression note|Audit summary):/
  const phaseNotes = Object.fromEntries(['E', 'S', 'P'].map((phase, index) => [phase,
    paragraphs(parts[String(index + 2)]).filter((block) => !tailLabels.test(block)).map(plain),
  ]))
  const exercises = session.exercises.map((exercise, index) => {
    const entry = entries[index]
    const prep = preparation.find(({ slot }) => slot === exercise.id)
    const prepSides = prep?.sides ?? prep?.execution_sides
    const prepIndex = Number(exercise.id.slice(1))
    const prepNote = prep ? `Load preparation, separate from working sets: ${prep.reps_by_set.map((reps) => `1 × ${reps}`).join(' then ')}${prepSides === 2 ? ' per arm' : ''}. Start very light; a second set is intermediate. Keep at least 5 technical reps in reserve. Rest 60 seconds between preparation rounds${prepSides === 2 ? ', 30 seconds between arms' : ''}, then ${prepIndex <= 2 ? 90 : 60} seconds before working sets. Extra load-finding reps add actual workload and time.` : null
    const rest = entry ? [
      entry.sets > 1 && `${entry.rest} s between sets`,
      entry.sides > 1 && `${entry.side_rest} s between ${entry.side_label ?? 'arm'} sides`,
      entry.reset_pattern_seconds ? `${entry.reset_pattern_seconds.join(' / ')} s between-rep gaps` : entry.reset_seconds > 0 && `${entry.reset_seconds} s between reps`,
      exercise.id.startsWith('E') ? '90 s before next exercise' : exercise.id === 'S1' ? '45 s before S2' : exercise.id === 'S2' ? '60 s before strength preparation' : prepIndex < 6 && `${prepIndex <= 3 ? 120 : 90} s before next lift preparation`,
    ].filter(Boolean).join('; ') : exercise.rest
    return { ...exercise, rest: rest || 'See phase recovery notes', preparation: prepNote,
      equipment: equipmentFor(exercise.name, entry?.cue ?? exercise.instruction) }
  })
  const firstAudit = isFirst ? readFileSync(new URL('class_01_audit.md', source), 'utf8') : ''
  const setup = isFirst
    ? plain(firstAudit.split('## Delivery and replacement decisions\n')[1].split('## Timing arithmetic')[0])
    : note(markdown, 'Delivery:')
  return { ...session, exercises, phaseNotes, setup,
    equipment: unique(exercises.flatMap(({ equipment }) => equipment)).filter((item) => item !== 'Bodyweight'),
    minutes: workload.summary.estimated_prescribed_work_minutes,
    delivery: [note(markdown, 'Workload and timing:'), note(markdown, 'Timing and scheduling:'), note(markdown, 'Scheduling:')].filter(Boolean).join(' '),
    quality: note(markdown, 'Quality marker,'),
    explosiveNotes: [note(markdown, 'Baseline'), note(markdown, 'Daily stimulus brief:')].filter(Boolean).join(' '),
    progression: note(markdown, 'Progression note:'),
  }
}
