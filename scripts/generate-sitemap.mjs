import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  GYMNASTICS_ORIGIN,
  GYMNASTICS_SITEMAP_ENTRIES,
  HUB_ORIGIN,
  HUB_SITEMAP_ENTRIES,
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

const wrapUrlset = (urls) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`

// Per-host sitemaps must contain only URLs owned by that hostname. Placeholder
// sport domains are intentionally excluded until each has its own substantive
// content and same-origin sitemap.
const hubSitemap = wrapUrlset(hubUrls)
const gymnasticsSitemap = wrapUrlset(gymnasticsUrls)

writeFileSync(join(publicDir, 'sitemap.xml'), hubSitemap, 'utf8')
writeFileSync(join(publicDir, 'sitemap-gymnastics.xml'), gymnasticsSitemap, 'utf8')
console.log(
  `Generated sitemap.xml with ${hubUrls.length} URLs and ` +
    `sitemap-gymnastics.xml with ${gymnasticsUrls.length} URLs`,
)
