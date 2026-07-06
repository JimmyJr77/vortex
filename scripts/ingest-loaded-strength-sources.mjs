/**
 * Ingest barbell + dumbbell strength cards from source files into repo JSON.
 *
 * Run: node scripts/ingest-loaded-strength-sources.mjs
 * Optional env:
 *   BARBELL_JSON=/path/to/barbell-strength-exercises-summary.json
 *   DUMBBELL_MD=/path/to/dumbbell_strength_exercise_cards_all_50.md
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  MERGE_SLUGS,
  BARBELL_BOX_SQUAT_RENAME,
  mergeCard,
} from './data/loaded-strength-merge-overrides.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.HOME ?? ''

const BARBELL_JSON = process.env.BARBELL_JSON
  ?? path.join(HOME, 'Downloads/barbell-strength-exercises-summary.json')
const DUMBBELL_MD = process.env.DUMBBELL_MD
  ?? path.join(HOME, 'Downloads/dumbbell_strength_exercise_cards_all_50.md')

const OUT_JSON = path.join(__dirname, 'data/loaded-strength-all-cards.json')
const OUT_MD = path.join(__dirname, 'data/loaded-strength-all-cards.md')

const EQUIPMENT_KEY_MAP = { dumbbells: 'dumbbell' }
const SUPERVISION_MAP = { optional: 'recommended' }

function normalizeSupervision(card) {
  if (card.safety?.requires_coach_supervision) {
    card.safety.requires_coach_supervision =
      SUPERVISION_MAP[card.safety.requires_coach_supervision] ?? card.safety.requires_coach_supervision
  }
  return card
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
  return normalizeSupervision(card)
}

function parseDumbbellMd(content) {
  const match = content.match(/```json\n([\s\S]*?)\n```/)
  if (!match) throw new Error('Could not parse JSON block from dumbbell MD')
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

function processBarbellCard(card) {
  let c = normalizeEquipment(structuredClone(card))
  if (c.slug === BARBELL_BOX_SQUAT_RENAME.from) {
    c = {
      ...c,
      slug: BARBELL_BOX_SQUAT_RENAME.to,
      name: 'Barbell Box Squat',
      _action: 'insert',
      _renamedFrom: BARBELL_BOX_SQUAT_RENAME.from,
    }
  } else if (MERGE_SLUGS.has(c.slug)) {
    c = mergeCard(c.slug, c)
  } else {
    c._action = 'insert'
  }
  validateCard(c)
  return c
}

function processDumbbellCard(card) {
  let c = normalizeEquipment(structuredClone(card))
  if (MERGE_SLUGS.has(c.slug)) {
    c = mergeCard(c.slug, c)
  } else {
    c._action = 'insert'
  }
  validateCard(c)
  return c
}

function main() {
  if (!fs.existsSync(BARBELL_JSON)) throw new Error(`Missing barbell JSON: ${BARBELL_JSON}`)
  if (!fs.existsSync(DUMBBELL_MD)) throw new Error(`Missing dumbbell MD: ${DUMBBELL_MD}`)

  const barbellRaw = JSON.parse(fs.readFileSync(BARBELL_JSON, 'utf8')).cards
  const dumbbellRaw = parseDumbbellMd(fs.readFileSync(DUMBBELL_MD, 'utf8'))

  if (barbellRaw.length !== 50) throw new Error(`Expected 50 barbell cards, got ${barbellRaw.length}`)
  if (dumbbellRaw.length !== 50) throw new Error(`Expected 50 dumbbell cards, got ${dumbbellRaw.length}`)

  const barbellCards = barbellRaw.map(processBarbellCard)
  const dumbbellCards = dumbbellRaw.map(processDumbbellCard)

  const allSlugs = [...barbellCards, ...dumbbellCards].map((c) => c.slug)
  const dupes = allSlugs.filter((s, i) => allSlugs.indexOf(s) !== i)
  if (dupes.length) throw new Error(`Duplicate slugs after normalize: ${[...new Set(dupes)].join(', ')}`)

  const insertCount = allSlugs.filter((s, i) =>
    [...barbellCards, ...dumbbellCards][i]._action === 'insert',
  ).length
  const mergeCount = allSlugs.filter((s, i) =>
    [...barbellCards, ...dumbbellCards][i]._action === 'merge',
  ).length

  const output = {
    clusters: [
      {
        focus: 'barbell_strength',
        phase: 'capacity',
        card_count: barbellCards.length,
        cards: barbellCards,
      },
      {
        focus: 'dumbbell_strength',
        phase: 'capacity',
        card_count: dumbbellCards.length,
        cards: dumbbellCards,
      },
    ],
    meta: {
      total_cards: 100,
      insert_count: insertCount,
      merge_count: mergeCount,
      generated_at: new Date().toISOString(),
    },
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2))

  let md = '# Loaded Strength Exercise Cards (Barbell + Dumbbell)\n\n'
  md += `Generated ${output.meta.generated_at}. ${insertCount} inserts, ${mergeCount} merges.\n\n`
  for (const cluster of output.clusters) {
    md += `## ${cluster.focus} (${cluster.card_count})\n\n`
    for (const c of cluster.cards) {
      md += `- **${c.name}** (\`${c.slug}\`) — ${c._action}${c._renamedFrom ? ` (from ${c._renamedFrom})` : ''}\n`
    }
    md += '\n'
  }
  fs.writeFileSync(OUT_MD, md)

  console.log('Wrote', OUT_JSON)
  console.log('Wrote', OUT_MD)
  console.log(`Cards: ${output.meta.total_cards} (${insertCount} insert, ${mergeCount} merge)`)
}

main()
