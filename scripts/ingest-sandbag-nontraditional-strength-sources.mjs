/**
 * Ingest sandbag & non-traditional strength cards from source files into repo JSON.
 *
 * Run: node scripts/ingest-sandbag-nontraditional-strength-sources.mjs
 * Optional env:
 *   SANDBAG_JSON=/path/to/sandbag_nontraditional_strength_cards_all.json
 *   SANDBAG_MD=/path/to/sandbag_nontraditional_strength_cards_all.md
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.HOME ?? ''

const SANDBAG_JSON = process.env.SANDBAG_JSON
  ?? path.join(__dirname, 'data/sandbag-nontraditional-strength-all-cards.json')
const SANDBAG_MD = process.env.SANDBAG_MD
  ?? path.join(__dirname, 'data/sandbag-nontraditional-strength-all-cards.md')

const OUT_JSON = path.join(__dirname, 'data/sandbag-nontraditional-strength-all-cards.json')
const OUT_MD = path.join(__dirname, 'data/sandbag-nontraditional-strength-all-cards.md')

const REQUIRED_FIELDS = [
  'slug', 'name', 'family', 'primaryPhaseKey', 'subrole', 'slot',
  'cardSummary', 'description', 'coachLanguage', 'athleteLanguage',
  'movementRequirements', 'coachingExecution', 'dosage', 'scaling', 'safety', 'regimen', 'phaseProfile',
  'whyItWorks', 'whyItGoesHere', 'commonMisuse', 'scalingGuidance', 'bestPlacement',
]

function normalizeCard(card) {
  const c = structuredClone(card)
  c._action = 'insert'
  return c
}

function loadCards() {
  if (fs.existsSync(SANDBAG_JSON)) {
    const raw = JSON.parse(fs.readFileSync(SANDBAG_JSON, 'utf8'))
    return raw.cards ?? raw
  }
  if (fs.existsSync(SANDBAG_MD)) {
    const match = fs.readFileSync(SANDBAG_MD, 'utf8').match(/```json\n([\s\S]*?)\n```/)
    if (!match) throw new Error('Could not parse JSON block from sandbag MD')
    const parsed = JSON.parse(match[1])
    return parsed.cards ?? parsed
  }
  throw new Error(`Missing sandbag source: ${SANDBAG_JSON} or ${SANDBAG_MD}`)
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

function main() {
  const rawCards = loadCards()
  if (rawCards.length !== 50) throw new Error(`Expected 50 sandbag/non-traditional cards, got ${rawCards.length}`)

  const cards = rawCards.map(normalizeCard)
  for (const c of cards) validateCard(c)

  const slugs = cards.map((c) => c.slug)
  const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i)
  if (dupes.length) throw new Error(`Duplicate slugs: ${[...new Set(dupes)].join(', ')}`)

  const output = {
    library: {
      title: 'Top 50 Sandbag & Non-Traditional Strength Exercise Library',
      phase: 'capacity',
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

  let md = '# Sandbag & Non-Traditional Strength Exercise Cards (50)\n\n'
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
      const strength = c.scoring?.strength ?? 5
      const explosiveness = c.scoring?.explosiveness ?? 0
      md += `- **${c.name}** (\`${c.slug}\`) — Strength ${strength}/5; Explosiveness ${explosiveness}/5\n`
    }
    md += '\n'
  }
  fs.writeFileSync(OUT_MD, md)

  console.log('Wrote', OUT_JSON)
  console.log('Wrote', OUT_MD)
  console.log(`Cards: ${cards.length} (all insert)`)
}

main()
