import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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
  ['rotation-upper', 'rotational_explosiveness_upper_body'],
  ['rotation-lower', 'rotational_explosiveness_lower_body'],
]
const root = new URL('../workout_plan/', import.meta.url)
const target = new URL('../src/coach/data/acceleratorPrograms.json', import.meta.url)
const plain = (value = '') => value.replace(/\*\*/g, '').replace(/\[(.*?)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim()
const short = (value, length = 78) => value.length <= length ? value : `${value.slice(0, length).replace(/\s+\S*$/, '')}…`
const unique = (items) => [...new Set(items)]

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
    const [, name = '', dose = '', description = ''] = line.split('|').slice(1, -1).map(plain)
    return [{ name, sourceName: name, dose, description }]
  }).map((entry, index) => ({
    ...entry, id: `${phase}${index + 1}`,
    prescription: short(entry.dose.split(';')[0], 100), rest: restFor(entry.dose, entry.description),
    purpose: short(entry.description, 220), instruction: entry.description, preparation: null,
    equipment: equipmentFor(`${entry.name} ${entry.description}`),
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
  return {
    n, title: `Class ${n}`, effort, minutes: minuteMatch ? [Number(minuteMatch[1]), Number(minuteMatch[2])] : null, delivery,
    equipment: unique(exercises.flatMap((exercise) => exercise.equipment)).filter((item) => item !== 'Bodyweight'), exercises,
    quality: plain(marker?.[1] ?? ''), preparation: plain(part['1'] ?? ''),
    explosiveNotes: short(plain((part['2'] ?? '').split('| # |')[0]), 520), counts: { explosive: 6, resilience: 2, primary: 6 },
  }
}

const output = Object.fromEntries(programs.map(([id, source]) => [id, Array.from({ length: 12 }, (_, index) => buildSession(source, index + 1))]))
mkdirSync(new URL('../src/coach/data/', import.meta.url), { recursive: true })
const content = `${JSON.stringify(output, null, 2)}\n`
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== content) throw new Error('Accelerator data is stale; run node scripts/build-athleticism-accelerator.mjs')
  console.log(`Verified ${programs.length} programs / ${programs.length * 12} classes / ${programs.length * 12 * 14} exercise prescriptions against curriculum source.`)
} else { writeFileSync(target, content); console.log(`Wrote ${fileURLToPath(target)}`) }
