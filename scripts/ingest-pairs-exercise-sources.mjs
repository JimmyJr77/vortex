/**
 * Ingest pairs exercise cards from source files into repo JSON.
 *
 * Run: node scripts/ingest-pairs-exercise-sources.mjs
 * Optional env:
 *   PAIRS_JSON=/path/to/pairs_exercise_cards_all_50.json
 *   PAIRS_MD=/path/to/pairs_exercise_cards_all_50.md
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.HOME ?? ''

const PAIRS_JSON = process.env.PAIRS_JSON
  ?? path.join(HOME, 'Downloads/pairs_exercise_cards_all_50.json')
const PAIRS_MD = process.env.PAIRS_MD
  ?? path.join(HOME, 'Downloads/pairs_exercise_cards_all_50.md')

const REPO_JSON = path.join(__dirname, 'data/pairs-exercise-all-cards.json')
const REPO_MD = path.join(__dirname, 'data/pairs-exercise-all-cards.md')

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
  return c
}

function parseMdJsonBlock(content) {
  const match = content.match(/```json\n([\s\S]*?)\n```/)
  if (!match) throw new Error('Could not parse JSON block from pairs MD')
  const parsed = JSON.parse(match[1])
  return { cluster: parsed.cluster, cards: parsed.cards ?? parsed }
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
  const pair = card.movementRequirements?.pair_profile
  if (!pair?.requires_exactly_two_people) {
    throw new Error(`Card ${card.slug} missing pair_profile.requires_exactly_two_people`)
  }
}

function loadSource() {
  const candidates = [PAIRS_JSON, REPO_JSON]
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
      return { cluster: raw.cluster, cards: raw.cards ?? raw }
    }
  }
  const mdCandidates = [PAIRS_MD, REPO_MD]
  for (const file of mdCandidates) {
    if (fs.existsSync(file)) return parseMdJsonBlock(fs.readFileSync(file, 'utf8'))
  }
  throw new Error(`Missing source: ${PAIRS_JSON}, ${REPO_JSON}, ${PAIRS_MD}, or ${REPO_MD}`)
}

function main() {
  const { cluster, cards: rawCards } = loadSource()
  if (rawCards.length !== 50) throw new Error(`Expected 50 cards, got ${rawCards.length}`)

  const cards = rawCards.map(normalizeCard)
  for (const c of cards) validateCard(c)

  const slugs = cards.map((c) => c.slug)
  const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i)
  if (dupes.length) throw new Error(`Duplicate slugs: ${[...new Set(dupes)].join(', ')}`)

  const output = {
    cluster: cluster ?? {
      focus: 'pairs',
      card_count: cards.length,
    },
    cards,
    meta: {
      total_cards: cards.length,
      generated_at: new Date().toISOString(),
    },
  }

  fs.writeFileSync(REPO_JSON, JSON.stringify(output, null, 2))

  let md = '# Pairs Exercise Cards (50)\n\n'
  md += `Generated ${output.meta.generated_at}. Merge vs insert resolved at migration generation time.\n\n`
  if (cluster?.definition) md += `${cluster.definition}\n\n`
  if (cluster?.categories) {
    for (const cat of cluster.categories) {
      md += `- **${cat.name}** (${cat.range}): ${cat.focus}\n`
    }
    md += '\n'
  }
  const byPhase = new Map()
  for (const c of cards) {
    const key = c.primaryPhaseKey
    if (!byPhase.has(key)) byPhase.set(key, [])
    byPhase.get(key).push(c)
  }
  for (const [phase, group] of byPhase) {
    md += `## ${phase} (${group.length})\n\n`
    const byFamily = new Map()
    for (const c of group) {
      if (!byFamily.has(c.family)) byFamily.set(c.family, [])
      byFamily.get(c.family).push(c)
    }
    for (const [family, famCards] of byFamily) {
      md += `### ${family}\n\n`
      for (const c of famCards) {
        md += `- **${c.name}** (\`${c.slug}\`)\n`
      }
      md += '\n'
    }
  }
  fs.writeFileSync(REPO_MD, md)

  console.log('Wrote', REPO_JSON)
  console.log('Wrote', REPO_MD)
  console.log(`Cards: ${cards.length}`)
}

main()
