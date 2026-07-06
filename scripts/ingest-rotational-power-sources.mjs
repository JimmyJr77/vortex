/**
 * Ingest rotational power exercise cards from source files into repo JSON.
 *
 * Run: node scripts/ingest-rotational-power-sources.mjs
 * Optional env:
 *   ROTATIONAL_JSON=/path/to/rotational_power_all_50.json
 *   ROTATIONAL_MD=/path/to/rotational_power_all_50.md
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.HOME ?? ''

const ROTATIONAL_JSON = process.env.ROTATIONAL_JSON
  ?? path.join(HOME, 'Downloads/rotational_power_all_50.json')
const ROTATIONAL_MD = process.env.ROTATIONAL_MD
  ?? path.join(HOME, 'Downloads/rotational_power_all_50.md')
const ALT_JSON = path.join(HOME, 'Desktop/untitled folder/rotational_power_all_50.json')

const OUT_JSON = path.join(__dirname, 'data/rotational-power-exercise-library-all-50.json')
const OUT_MD = path.join(__dirname, 'data/rotational-power-exercise-library-all-50.md')

function loadSource() {
  const candidates = [ROTATIONAL_JSON, ALT_JSON, OUT_JSON]
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
      return { library: raw.library ?? raw.cluster, cards: raw.cards ?? raw }
    }
  }
  if (fs.existsSync(ROTATIONAL_MD)) {
    const content = fs.readFileSync(ROTATIONAL_MD, 'utf8')
    const blocks = [...content.matchAll(/```json\n([\s\S]*?)\n```/g)]
    if (blocks.length === 0) throw new Error(`No JSON blocks in ${ROTATIONAL_MD}`)
    const cards = []
    let library = null
    for (const block of blocks) {
      const parsed = JSON.parse(block[1])
      if (parsed.library) library = parsed.library
      if (parsed.cluster && !library) library = parsed.cluster
      cards.push(...(parsed.cards ?? []))
    }
    return { library, cards }
  }
  throw new Error(`Missing source: ${ROTATIONAL_JSON}, ${ALT_JSON}, or ${OUT_JSON}`)
}

function main() {
  const { library, cards } = loadSource()
  if (cards.length !== 50) throw new Error(`Expected 50 cards, got ${cards.length}`)

  const output = {
    library: library ?? {
      title: 'Top 50 Rotational Athletes and Rotational Power Exercise Library',
      focus: 'rotational_athletes_rotational_power',
      card_count: 50,
    },
    cards,
    meta: {
      total_cards: cards.length,
      generated_at: new Date().toISOString(),
    },
  }

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2))

  let md = '# Top 50 Rotational Power Exercise Cards\n\n'
  md += `Generated ${output.meta.generated_at} from source ingest.\n\n`
  if (library?.purpose) md += `${library.purpose}\n\n`
  for (const c of cards) {
    md += `- **${c.name}** (\`${c.slug}\`) — ${c.primaryPhaseKey} / ${c.subrole}\n`
  }
  fs.writeFileSync(OUT_MD, md)

  console.log('Wrote', OUT_JSON)
  console.log('Wrote', OUT_MD)
  console.log('Cards:', cards.length)
}

main()
