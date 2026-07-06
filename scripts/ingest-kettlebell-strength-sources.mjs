/**
 * Ingest kettlebell strength cards from source files into repo JSON.
 *
 * Run: node scripts/ingest-kettlebell-strength-sources.mjs
 * Optional env:
 *   KETTLEBELL_JSON=/path/to/kettlebell_strength_exercise_cards_all_50.json
 *   KETTLEBELL_MD=/path/to/kettlebell_strength_exercise_cards_all_50.md
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.HOME ?? ''

const KETTLEBELL_JSON = process.env.KETTLEBELL_JSON
  ?? path.join(__dirname, 'data/kettlebell-strength-all-cards.json')
const KETTLEBELL_MD = process.env.KETTLEBELL_MD
  ?? path.join(__dirname, 'data/kettlebell-strength-all-cards.md')

const OUT_JSON = path.join(__dirname, 'data/kettlebell-strength-all-cards.json')
const OUT_MD = path.join(__dirname, 'data/kettlebell-strength-all-cards.md')

const EQUIPMENT_KEY_MAP = { kettlebells: 'kettlebell' }
const SUBROLE_KEY_MAP = { trunk_loaded_bracing_strength: 'carry_trunk_loaded_bracing_strength' }
const SUPERVISION_MAP = { optional: 'recommended' }

const REQUIRED_FIELDS = [
  'slug', 'name', 'family', 'primaryPhaseKey', 'subrole', 'slot',
  'cardSummary', 'description', 'coachLanguage', 'athleteLanguage',
  'movementRequirements', 'coachingExecution', 'dosage', 'scaling', 'safety', 'regimen', 'phaseProfile',
]

function normalizeCard(card) {
  const c = structuredClone(card)
  if (c.equipment) {
    c.equipment = c.equipment.map((t) => ({
      ...t,
      key: EQUIPMENT_KEY_MAP[t.key] ?? t.key,
    }))
  }
  if (SUBROLE_KEY_MAP[c.subrole]) c.subrole = SUBROLE_KEY_MAP[c.subrole]
  if (c.safety?.requires_coach_supervision) {
    c.safety.requires_coach_supervision =
      SUPERVISION_MAP[c.safety.requires_coach_supervision] ?? c.safety.requires_coach_supervision
  }
  c._action = 'insert'
  return c
}

function parseMdJsonBlock(content) {
  const match = content.match(/```json\n([\s\S]*?)\n```/)
  if (!match) throw new Error('Could not parse JSON block from kettlebell MD')
  return JSON.parse(match[1]).cards
}

function validateCard(card) {
  for (const f of REQUIRED_FIELDS) {
    if (card[f] == null || (typeof card[f] === 'string' && !card[f].trim())) {
      throw new Error(`Card ${card.slug} missing required field: ${f}`)
    }
  }
  const exec = card.coachingExecution
  if (!exec.setup?.length || !exec.execution_steps?.length) {
    throw new Error(`Card ${card.slug} missing setup or execution_steps in coachingExecution`)
  }
}

function loadCards() {
  if (fs.existsSync(KETTLEBELL_JSON)) {
    const raw = JSON.parse(fs.readFileSync(KETTLEBELL_JSON, 'utf8'))
    return raw.cards ?? raw
  }
  if (fs.existsSync(KETTLEBELL_MD)) {
    return parseMdJsonBlock(fs.readFileSync(KETTLEBELL_MD, 'utf8'))
  }
  throw new Error(`Missing kettlebell source: ${KETTLEBELL_JSON} or ${KETTLEBELL_MD}`)
}

function main() {
  const rawCards = loadCards()
  if (rawCards.length !== 50) throw new Error(`Expected 50 kettlebell cards, got ${rawCards.length}`)

  const cards = rawCards.map(normalizeCard)
  for (const c of cards) validateCard(c)

  const slugs = cards.map((c) => c.slug)
  const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i)
  if (dupes.length) throw new Error(`Duplicate slugs: ${[...new Set(dupes)].join(', ')}`)

  const output = {
    cluster: {
      phase: 'capacity',
      focus: 'kettlebell_strength',
      card_count: cards.length,
    },
    cards,
    meta: {
      total_cards: cards.length,
      insert_count: cards.length,
      merge_count: 0,
      generated_at: new Date().toISOString(),
    },
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2))

  let md = '# Kettlebell Strength Exercise Cards (50)\n\n'
  md += `Generated ${output.meta.generated_at}. ${cards.length} net-new Capacity inserts.\n\n`
  const byFamily = new Map()
  for (const c of cards) {
    const key = c.family
    if (!byFamily.has(key)) byFamily.set(key, [])
    byFamily.get(key).push(c)
  }
  for (const [family, group] of byFamily) {
    md += `## ${family}\n\n`
    for (const c of group) {
      md += `- **${c.name}** (\`${c.slug}\`) — Strength ${c.strengthScore ?? 5}; Explosiveness ${c.explosivenessScore ?? 0}\n`
    }
    md += '\n'
  }
  fs.writeFileSync(OUT_MD, md)

  console.log('Wrote', OUT_JSON)
  console.log('Wrote', OUT_MD)
  console.log(`Cards: ${cards.length} (all insert)`)
}

main()
