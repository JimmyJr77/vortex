import fs from 'fs'
import path from 'path'

const EMBEDDABLE_YOUTUBE =
  /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)/i

export function isEmbeddableYoutubeUrl(url) {
  return EMBEDDABLE_YOUTUBE.test(String(url ?? '').trim())
}

export function filterEmbeddableYoutubeLinks(links) {
  return [...new Set((links ?? []).map((u) => String(u).trim()).filter(isEmbeddableYoutubeUrl))]
}

export function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

export function buildSlugMap(rootDir) {
  const map = new Map()
  const migDir = path.join(rootDir, 'backend/migrations')
  const dataDir = path.join(rootDir, 'scripts/data')

  const sqlPair = /\(\s*'((?:''|[^'])*)'\s*,\s*'((?:''|[^'])*)'/g

  for (const file of fs.readdirSync(migDir).filter((f) => f.endsWith('.sql'))) {
    const text = fs.readFileSync(path.join(migDir, file), 'utf8')
    let match
    while ((match = sqlPair.exec(text)) !== null) {
      const name = match[1].replace(/''/g, "'").trim()
      const second = match[2].replace(/''/g, "'").trim()
      if (name && second.includes('-') && !second.includes(' ')) {
        map.set(name.toLowerCase(), second)
      }
    }
  }

  for (const file of fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'))) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'))
      const cards = data.cards ?? []
      for (const card of cards) {
        if (card?.name && card?.slug) {
          map.set(String(card.name).trim().toLowerCase(), String(card.slug).trim())
        }
      }
    } catch {
      // ignore invalid json
    }
  }

  return map
}

export function resolveExerciseSlug(entry, slugByName) {
  if (entry.slug) return entry.slug
  const nameKey = String(entry.name ?? '').trim().toLowerCase()
  return slugByName.get(nameKey) ?? null
}

export function buildYoutubeUpdate({ slug, name, youtube_links: links }) {
  const youtubeLinks = filterEmbeddableYoutubeLinks(links)
  if (youtubeLinks.length === 0) return null

  const arrayLiteral = `ARRAY[${youtubeLinks.map(sqlString).join(', ')}]::text[]`
  const whereClause = slug
    ? `e.slug = ${sqlString(slug)}`
    : `e.name = ${sqlString(name)}`

  return `-- ${name}${slug ? ` (${slug})` : ' (name match)'}
UPDATE coaching.exercise e
SET
  media_library = jsonb_set(
    COALESCE(e.media_library, '{}'::jsonb),
    '{clinical_or_sport_science_references}',
    COALESCE(
      (
        SELECT jsonb_agg(elem ORDER BY elem)
        FROM (
          SELECT DISTINCT elem
          FROM (
            SELECT jsonb_array_elements_text(
              COALESCE(e.media_library->'clinical_or_sport_science_references', '[]'::jsonb)
            ) AS elem
            UNION ALL
            SELECT unnest(${arrayLiteral}) AS elem
          ) combined
          WHERE elem IS NOT NULL AND btrim(elem) <> ''
            AND elem ~* '^https?://(www\\.)?(youtube\\.com/watch\\?v=|youtu\\.be/|youtube\\.com/shorts/|youtube\\.com/embed/)'
        ) deduped
      ),
      '[]'::jsonb
    ),
    true
  ),
  updated_at = now()
WHERE ${whereClause};
`
}
