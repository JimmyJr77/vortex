import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  GYMNASTICS_HOST_PAGES,
  GYMNASTICS_ORIGIN,
  GYMNASTICS_SITEMAP_ENTRIES,
  HUB_ORIGIN,
  HUB_SITEMAP_ENTRIES,
} from './seo-config.mjs'

const root = process.cwd()
const live = process.argv.includes('--live')
const failures = []

const extractUrls = (xml) => [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1])
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const tagValues = (html, regex) => [...html.matchAll(regex)].map((match) => match[1])

const expectedSets = [
  {
    label: 'athletics',
    origin: HUB_ORIGIN,
    sitemapPath: 'public/sitemap.xml',
    remoteSitemap: `${HUB_ORIGIN}/sitemap.xml`,
    entries: HUB_SITEMAP_ENTRIES,
  },
  {
    label: 'gymnastics',
    origin: GYMNASTICS_ORIGIN,
    sitemapPath: 'public/sitemap-gymnastics.xml',
    remoteSitemap: `${GYMNASTICS_ORIGIN}/sitemap-gymnastics.xml`,
    entries: GYMNASTICS_SITEMAP_ENTRIES,
  },
]

const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const distFileFor = (origin, path) => {
  if (origin === GYMNASTICS_ORIGIN) {
    const hostPage = GYMNASTICS_HOST_PAGES.find((page) => page.path === path)
    if (hostPage) return join(root, 'dist', hostPage.outFile)
  }
  return path === '/'
    ? join(root, 'dist/index.html')
    : join(root, 'dist', path.replace(/^\//, ''), 'index.html')
}

const verifyHtml = (label, html, canonical) => {
  const titles = tagValues(html, /<title>([\s\S]*?)<\/title>/gi)
  const descriptions = tagValues(html, /<meta\s+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/gi)
  const canonicals = tagValues(html, /<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/gi)
  const robots = tagValues(html, /<meta\s+name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/gi)
  const h1Count = (html.match(/<h1\b/gi) || []).length

  assert(titles.length === 1 && titles[0].trim(), `${label}: expected exactly one non-empty title`)
  assert(descriptions.length === 1 && descriptions[0].trim(), `${label}: expected exactly one non-empty meta description`)
  assert(canonicals.length === 1, `${label}: expected exactly one canonical, found ${canonicals.length}`)
  assert(canonicals[0]?.replace(/\/$/, '') === canonical.replace(/\/$/, ''), `${label}: canonical is ${canonicals[0] || 'missing'}, expected ${canonical}`)
  assert(h1Count === 1, `${label}: expected exactly one H1, found ${h1Count}`)
  assert(!robots.some((value) => /noindex/i.test(value)), `${label}: indexable route contains noindex`)
}

for (const set of expectedSets) {
  const xml = readFileSync(join(root, set.sitemapPath), 'utf8')
  const actualUrls = extractUrls(xml)
  const expectedUrls = set.entries.map(({ path }) => `${set.origin}${path === '/' ? '' : path}`)
  assert(actualUrls.length === expectedUrls.length, `${set.label} sitemap: found ${actualUrls.length}, expected ${expectedUrls.length}`)
  assert(new Set(actualUrls).size === actualUrls.length, `${set.label} sitemap: duplicate URLs found`)
  assert(
    expectedUrls.every((url) => actualUrls.includes(url)),
    `${set.label} sitemap: URL set differs from SEO configuration`,
  )

  for (const entry of set.entries) {
    const canonical = `${set.origin}${entry.path === '/' ? '' : entry.path}`
    const file = distFileFor(set.origin, entry.path)
    assert(existsSync(file), `${set.label}${entry.path}: prerendered file is missing (${file})`)
    if (existsSync(file)) verifyHtml(`${set.label}${entry.path}`, readFileSync(file, 'utf8'), canonical)
  }

  if (live) {
    const response = await fetch(set.remoteSitemap, { redirect: 'follow' })
    assert(response.ok, `${set.label} live sitemap returned HTTP ${response.status}`)
    if (response.ok) {
      const remoteUrls = extractUrls(await response.text())
      assert(
        remoteUrls.length === expectedUrls.length && expectedUrls.every((url) => remoteUrls.includes(url)),
        `${set.label} live sitemap does not match the release sitemap`,
      )
    }

    for (const entry of set.entries) {
      const canonical = `${set.origin}${entry.path === '/' ? '' : entry.path}`
      const response = await fetch(canonical, { redirect: 'follow' })
      assert(response.ok, `${canonical}: returned HTTP ${response.status}`)
      if (!response.ok) continue
      const contentType = response.headers.get('content-type') || ''
      assert(contentType.includes('text/html'), `${canonical}: expected HTML, received ${contentType}`)
      verifyHtml(`live ${canonical}`, await response.text(), canonical)
    }
  }
}

const robots = readFileSync(join(root, 'public/robots.txt'), 'utf8')
for (const set of expectedSets) {
  assert(
    new RegExp(`^Sitemap:\\s*${escapeRegex(set.remoteSitemap)}\\s*$`, 'mi').test(robots),
    `robots.txt: missing ${set.remoteSitemap}`,
  )
}

if (failures.length) {
  console.error(`SEO release verification failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

const routeCount = expectedSets.reduce((total, set) => total + set.entries.length, 0)
console.log(`SEO release verification passed (${routeCount} routes${live ? ', including live production' : ''}).`)
