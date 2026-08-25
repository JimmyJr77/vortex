import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  GYMNASTICS_ORIGIN,
  GYMNASTICS_SITEMAP_ENTRIES,
  HUB_ORIGIN,
  HUB_SITEMAP_ENTRIES,
  SEO_CONTENT_LASTMOD,
} from './seo-config.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

const urlEntry = (loc, priority, changefreq) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${SEO_CONTENT_LASTMOD}</lastmod>
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

const robotsPolicy = `User-agent: *
Allow: /
Disallow: /admin.html
Disallow: /admin
`

// Keep the fallback under a non-reserved filename. A physical public/robots.txt
// would win over Vercel rewrites and prevent host-specific sitemap routing.
writeFileSync(join(publicDir, 'robots-generic.txt'), robotsPolicy, 'utf8')
writeFileSync(
  join(publicDir, 'robots-hub.txt'),
  `${robotsPolicy}\nSitemap: ${HUB_ORIGIN}/sitemap.xml\n`,
  'utf8',
)
writeFileSync(
  join(publicDir, 'robots-gymnastics.txt'),
  `${robotsPolicy}\nSitemap: ${GYMNASTICS_ORIGIN}/sitemap-gymnastics.xml\n`,
  'utf8',
)
console.log(
  `Generated sitemap.xml with ${hubUrls.length} URLs and ` +
    `sitemap-gymnastics.xml with ${gymnasticsUrls.length} URLs, plus host-specific robots files`,
)
