/**
 * Ingest resistance band + body resistance cards from source files into repo JSON.
 *
 * Run: node scripts/ingest-resistance-band-body-resistance-sources.mjs
 * Optional env:
 *   BAND_JSON=/path/to/resistance_band_body_resistance_cards_all_50.json
 *   BAND_MD=/path/to/resistance_band_body_resistance_cards_all_50.md
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.HOME ?? ''

const BAND_JSON = process.env.BAND_JSON
  ?? path.join(HOME, 'Downloads/resistance_band_body_resistance_cards_all_50.json')
const BAND_MD = process.env.BAND_MD
  ?? path.join(HOME, 'Downloads/resistance_band_body_resistance_cards_all_50.md')

const REPO_JSON = path.join(__dirname, 'data/resistance-band-body-resistance-all-cards.json')
const REPO_MD = path.join(__dirname, 'data/resistance-band-body-resistance-all-cards.md')

const OUT_JSON = REPO_JSON
const OUT_MD = REPO_MD

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
  if (!match) throw new Error('Could not parse JSON block from resistance band MD')
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
}

function loadSource() {
  const candidates = [BAND_JSON, REPO_JSON]
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
      return { cluster: raw.cluster, cards: raw.cards ?? raw }
    }
  }
  const mdCandidates = [BAND_MD, REPO_MD]
  for (const file of mdCandidates) {
    if (fs.existsSync(file)) return parseMdJsonBlock(fs.readFileSync(file, 'utf8'))
  }
  throw new Error(`Missing source: ${BAND_JSON}, ${REPO_JSON}, ${BAND_MD}, or ${REPO_MD}`)
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
      phase: 'mixed_capacity_resilience',
      focus: 'resistance_band_and_body_resistance',
      card_count: cards.length,
    },
    cards,
    meta: {
      total_cards: cards.length,
      generated_at: new Date().toISOString(),
    },
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2))

  let md = '# Resistance Band and Body Resistance Exercise Cards (50)\n\n'
  md += `Generated ${output.meta.generated_at}. Merge vs insert resolved at migration generation time.\n\n`
  if (cluster?.source_basis) md += `Source basis: ${cluster.source_basis}\n\n`
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
  fs.writeFileSync(OUT_MD, md)

  console.log('Wrote', OUT_JSON)
  console.log('Wrote', OUT_MD)
  console.log(`Cards: ${cards.length}`)
}

main()
