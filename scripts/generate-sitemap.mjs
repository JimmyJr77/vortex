import { rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  HUB_ORIGIN,
  HUB_SITEMAP_ENTRIES,
  IMAGE_SITEMAP_NAMESPACE,
  VIDEO_SITEMAP_NAMESPACE,
} from './seo-config.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

const xmlText = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const assetUrl = path => xmlText(new URL(path, HUB_ORIGIN).href)

const imageEntry = (path) => `    <image:image>
      <image:loc>${assetUrl(path)}</image:loc>
    </image:image>`

const videoEntry = ({ thumbnail, name, description, assetPath, durationSeconds, uploadDate }) => `    <video:video>
      <video:thumbnail_loc>${assetUrl(thumbnail)}</video:thumbnail_loc>
      <video:title>${xmlText(name)}</video:title>
      <video:description>${xmlText(description)}</video:description>
      <video:content_loc>${assetUrl(assetPath)}</video:content_loc>
      <video:duration>${durationSeconds}</video:duration>
      <video:publication_date>${uploadDate}</video:publication_date>
    </video:video>`

const urlEntry = ({ path, priority, changefreq, lastmod, images = [], video }) => `  <url>
    <loc>${HUB_ORIGIN}${path === '/' ? '' : path}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${images.length ? `\n${images.map(imageEntry).join('\n')}` : ''}${video ? `\n${videoEntry(video)}` : ''}
  </url>`

const hubUrls = HUB_SITEMAP_ENTRIES.map(urlEntry)

const wrapUrlset = (urls) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="${IMAGE_SITEMAP_NAMESPACE}" xmlns:video="${VIDEO_SITEMAP_NAMESPACE}">
${urls.join('\n')}
</urlset>
`

// Per-host sitemaps must contain only URLs owned by that hostname. Placeholder
// sport domains are intentionally excluded until each has its own substantive
// content and same-origin sitemap.
const hubSitemap = wrapUrlset(hubUrls)

writeFileSync(join(publicDir, 'sitemap.xml'), hubSitemap, 'utf8')
// The old domain and sitemap URL redirect to the primary sitemap.
rmSync(join(publicDir, 'sitemap-gymnastics.xml'), { force: true })
rmSync(join(publicDir, 'robots-gymnastics.txt'), { force: true })

const robotsPolicy = `User-agent: *
Allow: /
`

// Keep the fallback under a non-reserved filename. A physical public/robots.txt
// would win over Vercel rewrites and prevent host-specific sitemap routing.
writeFileSync(join(publicDir, 'robots-generic.txt'), robotsPolicy, 'utf8')
writeFileSync(
  join(publicDir, 'robots-hub.txt'),
  `${robotsPolicy}\nSitemap: ${HUB_ORIGIN}/sitemap.xml\n`,
  'utf8',
)
console.log(`Generated one primary sitemap with ${hubUrls.length} URLs and robots files for the primary and coming-soon sites`)
