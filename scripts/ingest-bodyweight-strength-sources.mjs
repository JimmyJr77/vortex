/**
 * Ingest bodyweight strength cards from source files into repo JSON.
 *
 * Run: node scripts/ingest-bodyweight-strength-sources.mjs
 * Optional env:
 *   BODYWEIGHT_JSON=/path/to/bodyweight_strength_exercise_cards_all_50.json
 *   BODYWEIGHT_MD=/path/to/bodyweight_strength_exercise_cards_all_50.md
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.HOME ?? ''

const BODYWEIGHT_JSON = process.env.BODYWEIGHT_JSON
  ?? path.join(HOME, 'Downloads/bodyweight_strength_exercise_cards_all_50.json')
const BODYWEIGHT_MD = process.env.BODYWEIGHT_MD
  ?? path.join(HOME, 'Downloads/bodyweight_strength_exercise_cards_all_50.md')

const OUT_JSON = path.join(__dirname, 'data/bodyweight-strength-all-cards.json')
const OUT_MD = path.join(__dirname, 'data/bodyweight-strength-all-cards.md')

/** Existing Capacity seed slugs — hydrate in place, do not re-insert. */
const MERGE_SLUGS = new Set([
  'rear-foot-elevated-split-squat',
  'tibialis-raise',
  'push-up',
  'inverted-row',
  'hollow-body-hold',
])

const SUPERVISION_MAP = { optional: 'recommended' }

const REQUIRED_FIELDS = [
  'slug', 'name', 'family', 'primaryPhaseKey', 'subrole', 'slot',
  'cardSummary', 'description', 'coachLanguage', 'athleteLanguage',
  'movementRequirements', 'coachingExecution', 'dosage', 'scaling', 'safety', 'regimen', 'phaseProfile',
]

function normalizeCard(card) {
  const c = structuredClone(card)
  if (c.safety?.requires_coach_supervision) {
    c.safety.requires_coach_supervision =
      SUPERVISION_MAP[c.safety.requires_coach_supervision] ?? c.safety.requires_coach_supervision
  }
  c._action = MERGE_SLUGS.has(c.slug) ? 'merge' : 'insert'
  return c
}

function parseMdJsonBlock(content) {
  const match = content.match(/```json\n([\s\S]*?)\n```/)
  if (!match) throw new Error('Could not parse JSON block from bodyweight MD')
  const parsed = JSON.parse(match[1])
  return parsed.cards ?? parsed
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
  if (fs.existsSync(BODYWEIGHT_JSON)) {
    const raw = JSON.parse(fs.readFileSync(BODYWEIGHT_JSON, 'utf8'))
    return raw.cards ?? raw
  }
  if (fs.existsSync(BODYWEIGHT_MD)) {
    return parseMdJsonBlock(fs.readFileSync(BODYWEIGHT_MD, 'utf8'))
  }
  throw new Error(`Missing bodyweight source: ${BODYWEIGHT_JSON} or ${BODYWEIGHT_MD}`)
}

function main() {
  const rawCards = loadCards()
  if (rawCards.length !== 50) throw new Error(`Expected 50 bodyweight cards, got ${rawCards.length}`)

  const cards = rawCards.map(normalizeCard)
  for (const c of cards) validateCard(c)

  const slugs = cards.map((c) => c.slug)
  const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i)
  if (dupes.length) throw new Error(`Duplicate slugs: ${[...new Set(dupes)].join(', ')}`)

  const insertCount = cards.filter((c) => c._action === 'insert').length
  const mergeCount = cards.filter((c) => c._action === 'merge').length

  const output = {
    cluster: {
      phase: 'capacity',
      focus: 'bodyweight_strength',
      card_count: cards.length,
      equipment_scope: 'bodyweight only; support equipment allowed for leverage, range, or safety',
      merge_slugs: [...MERGE_SLUGS],
    },
    cards,
    meta: {
      total_cards: cards.length,
      insert_count: insertCount,
      merge_count: mergeCount,
      generated_at: new Date().toISOString(),
    },
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2))

  let md = '# Bodyweight Strength Exercise Cards (50)\n\n'
  md += `Generated ${output.meta.generated_at}. ${insertCount} net-new Capacity inserts; ${mergeCount} merge hydrations for existing slugs.\n\n`
  const byFamily = new Map()
  for (const c of cards) {
    const key = c.family
    if (!byFamily.has(key)) byFamily.set(key, [])
    byFamily.get(key).push(c)
  }
  for (const [family, group] of byFamily) {
    md += `## ${family}\n\n`
    for (const c of group) {
      const strength = c.scoring?.strengthScore ?? 5
      const explosive = c.scoring?.explosivenessScore ?? 0
      md += `- **${c.name}** (\`${c.slug}\`) [${c._action}] — Strength ${strength}; Explosiveness ${explosive}\n`
    }
    md += '\n'
  }
  fs.writeFileSync(OUT_MD, md)

  console.log('Wrote', OUT_JSON)
  console.log('Wrote', OUT_MD)
  console.log(`Cards: ${cards.length} (${insertCount} insert, ${mergeCount} merge)`)
}

main()
