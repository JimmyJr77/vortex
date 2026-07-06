/**
 * Ingest isometrics cards from source files into repo JSON.
 *
 * Run: node scripts/ingest-isometrics-sources.mjs
 * Optional env:
 *   ISOMETRICS_JSON=/path/to/isometrics_exercise_cards_all_50.json
 *   ISOMETRICS_MD=/path/to/isometrics_exercise_cards_all_50.md
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.HOME ?? ''

const ISOMETRICS_JSON = process.env.ISOMETRICS_JSON
  ?? path.join(HOME, 'Downloads/isometrics_exercise_cards_all_50.json')
const ISOMETRICS_MD = process.env.ISOMETRICS_MD
  ?? path.join(HOME, 'Downloads/isometrics_exercise_cards_all_50.md')

const OUT_JSON = path.join(__dirname, 'data/isometrics-all-cards.json')
const OUT_MD = path.join(__dirname, 'data/isometrics-all-cards.md')

const EQUIPMENT_KEY_MAP = {
  dumbbells: 'dumbbell',
  dumbbells_optional: 'dumbbell_optional',
  kettlebells: 'kettlebell',
  kettlebells_optional: 'kettlebell_optional',
  band: 'bands',
  band_optional: 'bands_optional',
  partner_optional: 'partner',
  sandbag_optional: 'sandbag',
  trap_bar_optional: 'trap_bar',
  yoga_block_optional: 'yoga_block',
  mat_optional: 'mat',
  pad_optional: 'pad',
}

const REQUIRED_FIELDS = [
  'slug', 'name', 'family', 'primaryPhaseKey', 'subrole', 'slot',
  'cardSummary', 'description', 'coachLanguage', 'athleteLanguage',
  'movementRequirements', 'coachingExecution', 'dosage', 'scaling', 'safety', 'regimen', 'phaseProfile',
]

function normalizeEquipment(card) {
  if (!card.equipment) return card
  card.equipment = card.equipment.map((t) => ({
    ...t,
    key: EQUIPMENT_KEY_MAP[t.key] ?? t.key,
  }))
  return card
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
  const raw = JSON.parse(fs.readFileSync(ISOMETRICS_JSON, 'utf8'))
  const cards = (raw.cards ?? []).map((c) => normalizeEquipment(structuredClone(c)))
  for (const card of cards) validateCard(card)

  const out = {
    cluster: {
      ...raw.cluster,
      focus: raw.cluster?.focus ?? 'isometrics',
      card_count: cards.length,
    },
    cards,
  }

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(out, null, 2)}\n`)
  if (fs.existsSync(ISOMETRICS_MD)) {
    fs.copyFileSync(ISOMETRICS_MD, OUT_MD)
  }
  console.log(`Wrote ${OUT_JSON} — ${cards.length} isometrics cards`)
}

main()
