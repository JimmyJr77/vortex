import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Build the coach-facing read model from the finalized curriculum. No doses are
// generated here: the written class tables remain the source of truth.
const source = new URL('../workout_plan/rotational_explosiveness_upper_body/', import.meta.url)
const target = new URL('../src/coach/data/rotationalUpperBody.json', import.meta.url)
const titles = [
  'Build a balanced release', 'Turn into a pushing release', 'Reverse the preload',
  'Step, plant & project', 'Arrive from the side', 'Consolidate & reduce volume',
  'Receive, organize & return', 'Find the diagonal', 'Connect entry to hand path',
  'Fast hands, stable base', 'Receive into an entry', 'Revisit & compare',
]
const plain = (value) => value.replace(/\*\*/g, '').trim()
const sessions = titles.map((title, index) => {
  const n = index + 1
  const file = `class_${String(n).padStart(2, '0')}`
  const record = JSON.parse(readFileSync(new URL(`supporting/class_records/${file}.json`, source), 'utf8'))
  const markdown = readFileSync(new URL(`classes/${file}.md`, source), 'utf8')
  const rows = markdown.split('\n').filter((line) => /^\| [ESP]\d \|/.test(line))
  const exercises = rows.map((line) => {
    const [id, writtenName, dose, execution] = line.split('|').slice(1, -1).map(plain)
    const phase = id[0]
    const entry = record[phase][Number(id[1]) - 1]
    const name = entry.name
      .replace(/ — (?:proposed|floor.target|standing.*band execution|non-rebounding).*$/i, '')
      .replace('Cable / Band ', 'Band ')
    const restMatch = execution.match(/Rest ([^.]+)\./i)
    const rest = phase === 'E'
      ? (n === 1 ? '90 s between sides / sets' : restMatch?.[1] ?? '')
      : phase === 'S'
        ? '30–45 s between sides'
        : entry.name === 'Landmine Rotation'
          ? (entry.sets > 1 ? '2–3 min between sets' : '90 s to next exercise')
          : `90 s between sides${entry.sets > 1 ? ' · 2 min between rounds' : ''}`
    if (!rest) throw new Error(`Missing recovery for class ${n}, ${id}`)
    const purposeMatch = line.split('|')[4].trim().match(/^\*\*(.*?)\*\*/)
    const purpose = plain(purposeMatch?.[1] ?? '')
    const instruction = execution.slice(purpose.length).trim()
    const equipment = []
    if (/ball|supplied.*return/i.test(entry.name)) equipment.push(entry.kind === 'slam' ? 'Slam ball' : 'Medicine ball')
    if (/band|pallof/i.test(entry.name)) equipment.push('Bands')
    if (/landmine/i.test(entry.name)) equipment.push('Landmine')
    if (/dumbbell/i.test(entry.name)) equipment.push('Dumbbells')
    if (/rope/i.test(entry.name)) equipment.push('Battle rope')
    if (/bench/.test(instruction) && !/instead.*bench|bench.*instead/.test(instruction)) equipment.push('Bench')
    return {
      id, phase, name, sourceName: plain(writtenName), dose,
      prescription: dose.split(';')[0], rest,
      preparation: phase === 'P'
        ? (entry.name === 'Landmine Rotation' ? '1 × 4 easy traverses' : `1 × ${[1, 12].includes(n) && entry.name === 'Landmine Rotational Press' ? 4 : 3} easy reps / side`)
        : null,
      purpose, instruction, equipment: equipment.length ? equipment : ['Bodyweight'],
    }
  })
  if (exercises.length !== 14) throw new Error(`Expected 14 exercises for class ${n}`)
  const equipment = [...new Set(exercises.flatMap((exercise) => exercise.equipment))].filter((item) => item !== 'Bodyweight')
  const paragraph = (prefix) => plain(markdown.split('\n').find((line) => line.startsWith(prefix)) ?? '').replace(/^[^:]+:\s*/, '')
  return {
    n, title, effort: record.effort,
    minutes: record.estimated_minutes_excluding_access_prepare_1_and_added_queues,
    releases: record.workload.ball_releases,
    fastActions: record.workload.retained_or_unloaded_fast_actions,
    strengthReps: record.workload.P.reps,
    equipment, exercises,
    quality: paragraph(n === 1 ? '**Quality marker:' : '**Integrated quality marker:'),
    preparation: paragraph(n === 1 ? '**Preparation sets,' : '**Load-preparation sets:'),
    explosiveNotes: plain(markdown.split('## 2. Explosiveness')[1].split('| # |')[0]),
  }
})
mkdirSync(new URL('../src/coach/data/', import.meta.url), { recursive: true })
const content = `${JSON.stringify(sessions, null, 2)}\n`
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== content) throw new Error('Accelerator data is stale; run node scripts/build-athleticism-accelerator.mjs')
  console.log(`Verified ${sessions.length} classes / ${sessions.reduce((count, session) => count + session.exercises.length, 0)} exercise prescriptions against the source.`)
} else {
  writeFileSync(target, content)
  console.log(`Wrote ${fileURLToPath(target)}`)
}
