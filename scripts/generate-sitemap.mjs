import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  GYMNASTICS_ORIGIN,
  GYMNASTICS_SITEMAP_ENTRIES,
  HUB_ORIGIN,
  HUB_SITEMAP_ENTRIES,
  STUB_SEO_ENTRIES,
} from './seo-config.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

const today = new Date().toISOString().slice(0, 10)

const urlEntry = (loc, priority, changefreq) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`

const hubUrls = HUB_SITEMAP_ENTRIES.map((entry) => {
  const path = entry.path === '/' ? '' : entry.path
  return urlEntry(`${HUB_ORIGIN}${path}`, entry.priority, entry.changefreq)
})

const gymnasticsUrls = GYMNASTICS_SITEMAP_ENTRIES.map((entry) => {
  const path = entry.path === '/' ? '' : entry.path
  return urlEntry(
    `${GYMNASTICS_ORIGIN}${path}`,
    entry.priority,
    entry.changefreq,
  )
})

const stubUrls = STUB_SEO_ENTRIES.map((stub) =>
  urlEntry(stub.canonical, '0.6', 'monthly'),
)

const allUrls = [...hubUrls, ...gymnasticsUrls, ...stubUrls]

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.join('\n')}
</urlset>
`

writeFileSync(join(publicDir, 'sitemap.xml'), sitemap, 'utf8')
console.log(`Generated sitemap.xml with ${allUrls.length} URLs`)
