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

const wrapUrlset = (urls) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`

// Per-host sitemaps so each domain only lists its own URLs (no cross-domain mixing).
// Hub sitemap (vortexathletics.com) carries the hub pages plus the coming-soon
// stub domains; gymnastics gets its own sitemap referenced from its robots.txt line.
const hubSitemap = wrapUrlset([...hubUrls, ...stubUrls])
const gymnasticsSitemap = wrapUrlset(gymnasticsUrls)

writeFileSync(join(publicDir, 'sitemap.xml'), hubSitemap, 'utf8')
writeFileSync(join(publicDir, 'sitemap-gymnastics.xml'), gymnasticsSitemap, 'utf8')
console.log(
  `Generated sitemap.xml with ${hubUrls.length + stubUrls.length} URLs and ` +
    `sitemap-gymnastics.xml with ${gymnasticsUrls.length} URLs`,
)
