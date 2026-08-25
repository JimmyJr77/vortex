import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  GYMNASTICS_HOST_PAGES,
  GYMNASTICS_NOINDEX_PRERENDER_PATHS,
  GYMNASTICS_ORIGIN,
  GYMNASTICS_SITEMAP_ENTRIES,
  HUB_NOINDEX_PRERENDER_PATHS,
  HUB_ORIGIN,
  HUB_SITEMAP_ENTRIES,
  SEO_CONTENT_LASTMOD,
  SITE_NAME,
  STUB_SEO_ENTRIES,
} from './seo-config.mjs'

const root = process.cwd()
const live = process.argv.includes('--live')
const failures = []
const indexedTitles = new Map()
const indexedDescriptions = new Map()
const verifiedLocalAssets = new Set()

const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const decodeHtml = (value = '') =>
  value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const tags = (html, name) =>
  [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((match) => match[0])

const attribute = (tag, name) => {
  const match = tag.match(
    new RegExp(`\\s${escapeRegex(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'),
  )
  return decodeHtml(match?.[1] ?? match?.[2] ?? '')
}

const metaValues = (html, attributeName, attributeValue) =>
  tags(html, 'meta')
    .filter((tag) => attribute(tag, attributeName).toLowerCase() === attributeValue.toLowerCase())
    .map((tag) => attribute(tag, 'content'))

const linkValues = (html, rel) =>
  tags(html, 'link')
    .filter((tag) => attribute(tag, 'rel').toLowerCase() === rel.toLowerCase())
    .map((tag) => attribute(tag, 'href'))

const titleValues = (html) =>
  [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)].map((match) =>
    decodeHtml(match[1].replace(/<[^>]*>/g, '').trim()),
  )

const h1Values = (html) =>
  [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) =>
    decodeHtml(match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()),
  )

const jsonLdValues = (html) =>
  [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim())

const normalizedUrl = (value) => {
  try {
    const url = new URL(value)
    url.hash = ''
    if (url.pathname === '/') url.pathname = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return value
  }
}

const canonicalFor = (origin, path) => `${origin}${path === '/' ? '' : path}`

const verifyLocalAssets = (label, html) => {
  const candidates = [
    ...tags(html, 'img').flatMap((tag) => [attribute(tag, 'src'), attribute(tag, 'srcset')]),
    ...tags(html, 'source').map((tag) => attribute(tag, 'srcset')),
    ...tags(html, 'video').map((tag) => attribute(tag, 'poster')),
    ...metaValues(html, 'property', 'og:image'),
    ...tags(html, 'link')
      .filter((tag) => ['image', 'font'].includes(attribute(tag, 'as').toLowerCase()))
      .map((tag) => attribute(tag, 'href')),
  ]
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().split(/\s+/)[0])
    .filter(Boolean)

  for (const candidate of candidates) {
    let url
    try {
      url = new URL(candidate, HUB_ORIGIN)
    } catch {
      failures.push(`${label}: invalid asset URL ${candidate}`)
      continue
    }
    if (![HUB_ORIGIN, GYMNASTICS_ORIGIN].includes(url.origin)) continue
    if (!/\.(?:avif|webp|png|jpe?g|gif|svg|woff2?)$/i.test(url.pathname)) continue

    const pathname = decodeURIComponent(url.pathname)
    if (verifiedLocalAssets.has(pathname)) continue
    verifiedLocalAssets.add(pathname)
    const file = join(root, 'dist', pathname.replace(/^\//, ''))
    assert(existsSync(file), `${label}: referenced asset is missing (${pathname})`)
    if (!existsSync(file)) continue

    const bytes = statSync(file).size
    if (/\.(?:avif|webp|png|jpe?g|gif)$/i.test(pathname)) {
      assert(
        bytes <= 1024 * 1024,
        `${label}: ${pathname} is ${(bytes / 1024 / 1024).toFixed(2)} MiB; public images must be at most 1 MiB`,
      )
    }
  }
}

const extractUrls = (xml) => [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1])
const extractSitemapRows = (xml) =>
  [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => ({
    loc: match[1].match(/<loc>(.*?)<\/loc>/)?.[1] ?? '',
    lastmod: match[1].match(/<lastmod>(.*?)<\/lastmod>/)?.[1] ?? '',
  }))

const expectedSets = [
  {
    label: 'athletics',
    origin: HUB_ORIGIN,
    sitemapPath: 'public/sitemap.xml',
    robotsPath: 'public/robots-hub.txt',
    remoteSitemap: `${HUB_ORIGIN}/sitemap.xml`,
    remoteRobots: `${HUB_ORIGIN}/robots.txt`,
    entries: HUB_SITEMAP_ENTRIES,
    noindexPaths: HUB_NOINDEX_PRERENDER_PATHS,
  },
  {
    label: 'gymnastics',
    origin: GYMNASTICS_ORIGIN,
    sitemapPath: 'public/sitemap-gymnastics.xml',
    robotsPath: 'public/robots-gymnastics.txt',
    remoteSitemap: `${GYMNASTICS_ORIGIN}/sitemap-gymnastics.xml`,
    remoteRobots: `${GYMNASTICS_ORIGIN}/robots.txt`,
    entries: GYMNASTICS_SITEMAP_ENTRIES,
    noindexPaths: GYMNASTICS_NOINDEX_PRERENDER_PATHS,
  },
]

const distFileFor = (origin, path) => {
  if (origin === GYMNASTICS_ORIGIN) {
    const hostPage = GYMNASTICS_HOST_PAGES.find((page) => page.path === path)
    if (hostPage) return join(root, 'dist', hostPage.outFile)
  }
  return path === '/'
    ? join(root, 'dist/index.html')
    : join(root, 'dist', path.replace(/^\//, ''), 'index.html')
}

const rememberUnique = (map, value, label, kind) => {
  const existing = map.get(value)
  if (existing) {
    failures.push(`${label}: duplicate ${kind} also used by ${existing}`)
    return
  }
  map.set(value, label)
}

const verifyHtml = (
  label,
  html,
  canonical,
  { shouldIndex = true, requireH1 = true, requireSchema = true } = {},
) => {
  const htmlTags = tags(html, 'html')
  const titles = titleValues(html)
  const descriptions = metaValues(html, 'name', 'description')
  const canonicals = linkValues(html, 'canonical')
  const robots = metaValues(html, 'name', 'robots')
  const ogUrls = metaValues(html, 'property', 'og:url')
  const ogImages = metaValues(html, 'property', 'og:image')
  const ogImageAlts = metaValues(html, 'property', 'og:image:alt')
  const ogSiteNames = metaValues(html, 'property', 'og:site_name')
  const twitterCards = metaValues(html, 'name', 'twitter:card')
  const h1s = h1Values(html)
  const jsonLd = jsonLdValues(html)
  const eagerThirdPartyScripts = tags(html, 'script')
    .map((tag) => attribute(tag, 'src'))
    .filter((src) => /(?:googletagmanager\.com|google-analytics\.com)/i.test(src))
  const trackingIframes = tags(html, 'iframe')
    .map((tag) => attribute(tag, 'src'))
    .filter((src) => /googletagmanager\.com/i.test(src))
  const externalFontStylesheets = tags(html, 'link')
    .map((tag) => attribute(tag, 'href'))
    .filter((href) => /fonts\.(?:googleapis|gstatic)\.com/i.test(href))
  const anchorBlocks = [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].map((match) => match[0])

  if (!label.startsWith('live ')) verifyLocalAssets(label, html)

  assert(htmlTags.length === 1, `${label}: expected exactly one html element`)
  assert(attribute(htmlTags[0] ?? '', 'lang').toLowerCase().startsWith('en'), `${label}: html lang must be English`)
  assert(titles.length === 1 && titles[0], `${label}: expected exactly one non-empty title`)
  assert(
    titles[0]?.length >= 20 && titles[0]?.length <= 75,
    `${label}: title length is ${titles[0]?.length ?? 0}; expected 20-75 characters`,
  )
  assert(
    descriptions.length === 1 && descriptions[0].trim(),
    `${label}: expected exactly one non-empty meta description`,
  )
  assert(
    descriptions[0]?.length >= 70 && descriptions[0]?.length <= 175,
    `${label}: description length is ${descriptions[0]?.length ?? 0}; expected 70-175 characters`,
  )
  assert(canonicals.length === 1, `${label}: expected exactly one canonical, found ${canonicals.length}`)
  assert(
    normalizedUrl(canonicals[0]) === normalizedUrl(canonical),
    `${label}: canonical is ${canonicals[0] || 'missing'}, expected ${canonical}`,
  )
  assert(ogUrls.length === 1, `${label}: expected exactly one og:url`)
  assert(
    normalizedUrl(ogUrls[0]) === normalizedUrl(canonical),
    `${label}: og:url is ${ogUrls[0] || 'missing'}, expected ${canonical}`,
  )
  assert(
    ogImages.length === 1 && /^https:\/\//.test(ogImages[0]),
    `${label}: expected one absolute HTTPS og:image`,
  )
  assert(
    ogImageAlts.length === 1 && ogImageAlts[0].trim(),
    `${label}: expected one non-empty og:image:alt`,
  )
  const expectedSiteName = canonical.startsWith(GYMNASTICS_ORIGIN)
    ? 'Vortex Gymnastics'
    : SITE_NAME
  assert(
    ogSiteNames.length === 1 && ogSiteNames[0] === expectedSiteName,
    `${label}: og:site_name is ${ogSiteNames[0] || 'missing'}, expected ${expectedSiteName}`,
  )
  assert(
    twitterCards.length === 1 && twitterCards[0] === 'summary_large_image',
    `${label}: expected one summary_large_image Twitter card`,
  )
  assert(
    eagerThirdPartyScripts.length === 0,
    `${label}: analytics must not load before consent (${eagerThirdPartyScripts.join(', ')})`,
  )
  assert(
    trackingIframes.length === 0,
    `${label}: tracking iframe must not load before consent (${trackingIframes.join(', ')})`,
  )
  assert(
    externalFontStylesheets.length === 0,
    `${label}: fonts must be self-hosted (${externalFontStylesheets.join(', ')})`,
  )
  assert(
    !anchorBlocks.some((anchor) => /<button\b/i.test(anchor)),
    `${label}: a link must not contain a nested button`,
  )
  assert(
    !anchorBlocks.some((anchor) => /\btabindex=["']0["']/i.test(anchor)),
    `${label}: a link must not contain another keyboard focus target`,
  )

  if (requireH1) {
    assert(h1s.length === 1 && h1s[0], `${label}: expected exactly one non-empty H1, found ${h1s.length}`)
  }

  if (shouldIndex) {
    assert(!robots.some((value) => /noindex/i.test(value)), `${label}: indexable route contains noindex`)
    if (titles[0] && !label.startsWith('live ')) {
      rememberUnique(indexedTitles, titles[0].toLowerCase(), label, 'title')
    }
    if (descriptions[0] && !label.startsWith('live ')) {
      rememberUnique(indexedDescriptions, descriptions[0].toLowerCase(), label, 'description')
    }
  } else {
    assert(
      robots.length === 1 && /(?:^|,)\s*noindex\b/i.test(robots[0]),
      `${label}: expected exactly one noindex robots directive`,
    )
  }

  if (requireSchema) {
    assert(jsonLd.length >= 2, `${label}: expected Organization and WebSite JSON-LD`)
    const parsed = []
    for (const [index, raw] of jsonLd.entries()) {
      try {
        parsed.push(JSON.parse(raw))
      } catch (error) {
        failures.push(`${label}: JSON-LD block ${index + 1} is invalid (${error.message})`)
      }
    }
    const types = parsed.flatMap((item) => {
      const type = item?.['@type']
      return Array.isArray(type) ? type : [type]
    })
    assert(types.includes('Organization'), `${label}: Organization JSON-LD is missing`)
    assert(types.includes('WebSite'), `${label}: WebSite JSON-LD is missing`)

    if (
      normalizedUrl(canonical) === normalizedUrl(HUB_ORIGIN) ||
      normalizedUrl(canonical) === normalizedUrl(GYMNASTICS_ORIGIN)
    ) {
      const location = parsed.find((item) => item?.['@type'] === 'SportsActivityLocation')
      assert(location, `${label}: SportsActivityLocation JSON-LD is missing`)
      assert(
        location?.name === 'Vortex Athletics and Gymnastics',
        `${label}: local business name does not match the Google Business Profile`,
      )
      assert(
        location?.telephone === '+1-443-422-4794',
        `${label}: local business telephone is incorrect`,
      )
      assert(
        location?.address?.streetAddress === '4961 Tesla Dr Suite E' &&
          location?.address?.addressLocality === 'Bowie' &&
          location?.address?.addressRegion === 'MD' &&
          location?.address?.postalCode === '20715',
        `${label}: local business address is incomplete or inconsistent`,
      )
      assert(
        Number(location?.geo?.latitude) === 38.9564345 &&
          Number(location?.geo?.longitude) === -76.7076355,
        `${label}: local business coordinates are incorrect`,
      )
      assert(
        location?.hasMap === 'https://www.google.com/maps?cid=15262285316302188709',
        `${label}: local business map entity is incorrect`,
      )
    }
  }
}

for (const set of expectedSets) {
  const xml = readFileSync(join(root, set.sitemapPath), 'utf8')
  const actualUrls = extractUrls(xml)
  const rows = extractSitemapRows(xml)
  const expectedUrls = set.entries.map(({ path }) => canonicalFor(set.origin, path))

  assert(actualUrls.length === expectedUrls.length, `${set.label} sitemap: found ${actualUrls.length}, expected ${expectedUrls.length}`)
  assert(new Set(actualUrls).size === actualUrls.length, `${set.label} sitemap: duplicate URLs found`)
  assert(expectedUrls.every((url) => actualUrls.includes(url)), `${set.label} sitemap: URL set differs from SEO configuration`)
  assert(
    rows.every((row) => row.lastmod === SEO_CONTENT_LASTMOD),
    `${set.label} sitemap: every lastmod must be ${SEO_CONTENT_LASTMOD}`,
  )
  for (const url of actualUrls) {
    try {
      assert(new URL(url).origin === set.origin, `${set.label} sitemap: cross-host URL ${url}`)
    } catch {
      assert(false, `${set.label} sitemap: invalid URL ${url}`)
    }
  }
  for (const path of set.noindexPaths) {
    assert(!actualUrls.includes(canonicalFor(set.origin, path)), `${set.label} sitemap: noindex route ${path} was included`)
  }

  for (const entry of set.entries) {
    const canonical = canonicalFor(set.origin, entry.path)
    const file = distFileFor(set.origin, entry.path)
    assert(existsSync(file), `${set.label}${entry.path}: prerendered file is missing (${file})`)
    if (existsSync(file)) verifyHtml(`${set.label}${entry.path}`, readFileSync(file, 'utf8'), canonical)
  }

  for (const path of set.noindexPaths) {
    const canonical = canonicalFor(set.origin, path)
    const file = distFileFor(set.origin, path)
    assert(existsSync(file), `${set.label}${path}: noindex prerender is missing (${file})`)
    if (existsSync(file)) {
      verifyHtml(`${set.label}${path}`, readFileSync(file, 'utf8'), canonical, { shouldIndex: false })
    }
  }

  const hostRobots = readFileSync(join(root, set.robotsPath), 'utf8')
  assert(
    !/^Disallow:\s*\/\*\?sport=/mi.test(hostRobots),
    `${set.robotsPath}: preview URLs must remain crawlable so search engines can see noindex`,
  )
  assert(
    new RegExp(`^Sitemap:\\s*${escapeRegex(set.remoteSitemap)}\\s*$`, 'mi').test(hostRobots),
    `${set.robotsPath}: missing ${set.remoteSitemap}`,
  )
  for (const otherSet of expectedSets.filter((candidate) => candidate !== set)) {
    assert(!hostRobots.includes(otherSet.remoteSitemap), `${set.robotsPath}: contains cross-host sitemap ${otherSet.remoteSitemap}`)
  }

  if (live) {
    const sitemapResponse = await fetch(set.remoteSitemap, { redirect: 'follow' })
    assert(sitemapResponse.ok, `${set.label} live sitemap returned HTTP ${sitemapResponse.status}`)
    assert(
      normalizedUrl(sitemapResponse.url) === normalizedUrl(set.remoteSitemap),
      `${set.label} live sitemap resolved to ${sitemapResponse.url}, expected ${set.remoteSitemap}`,
    )
    if (sitemapResponse.ok) {
      const remoteUrls = extractUrls(await sitemapResponse.text())
      assert(
        remoteUrls.length === expectedUrls.length && expectedUrls.every((url) => remoteUrls.includes(url)),
        `${set.label} live sitemap does not match the release sitemap`,
      )
    }

    const robotsResponse = await fetch(set.remoteRobots, { redirect: 'follow' })
    assert(robotsResponse.ok, `${set.label} live robots.txt returned HTTP ${robotsResponse.status}`)
    assert(
      normalizedUrl(robotsResponse.url) === normalizedUrl(set.remoteRobots),
      `${set.label} live robots.txt resolved to ${robotsResponse.url}, expected ${set.remoteRobots}`,
    )
    if (robotsResponse.ok) {
      const remoteRobots = await robotsResponse.text()
      assert(remoteRobots.includes(set.remoteSitemap), `${set.label} live robots.txt is missing its sitemap`)
      assert(
        !/^Disallow:\s*\/\*\?sport=/mi.test(remoteRobots),
        `${set.label} live robots.txt blocks preview URLs from exposing their noindex directive`,
      )
      for (const otherSet of expectedSets.filter((candidate) => candidate !== set)) {
        assert(!remoteRobots.includes(otherSet.remoteSitemap), `${set.label} live robots.txt contains a cross-host sitemap`)
      }
    }

    for (const entry of set.entries) {
      const canonical = canonicalFor(set.origin, entry.path)
      const response = await fetch(canonical, { redirect: 'follow' })
      assert(response.ok, `${canonical}: returned HTTP ${response.status}`)
      assert(
        normalizedUrl(response.url) === normalizedUrl(canonical),
        `${canonical}: resolved to ${response.url}; canonical host/path mismatch`,
      )
      if (!response.ok) continue
      const contentType = response.headers.get('content-type') || ''
      assert(contentType.includes('text/html'), `${canonical}: expected HTML, received ${contentType}`)
      verifyHtml(`live ${canonical}`, await response.text(), canonical)
    }

    const notFoundUrl = `${set.origin}/__seo-release-404-check__`
    const notFoundResponse = await fetch(notFoundUrl, { redirect: 'manual' })
    assert(
      notFoundResponse.status === 404,
      `${set.label} unknown route returned HTTP ${notFoundResponse.status}; expected a real 404`,
    )
    if (notFoundResponse.status === 404) {
      const notFoundHtml = await notFoundResponse.text()
      assert(
        metaValues(notFoundHtml, 'name', 'robots').some((value) => /noindex/i.test(value)),
        `${set.label} live 404 page is missing noindex`,
      )
    }
  }
}

if (live) {
  const hostRedirectChecks = [
    {
      label: 'athletics www host',
      sourceOrigin: 'https://www.vortexathletics.com',
      canonicalOrigin: HUB_ORIGIN,
    },
    {
      label: 'gymnastics apex host',
      sourceOrigin: 'https://vortex-gymnastics.com',
      canonicalOrigin: GYMNASTICS_ORIGIN,
    },
  ]
  for (const check of hostRedirectChecks) {
    const path = '/__seo-host-redirect-check__'
    const response = await fetch(`${check.sourceOrigin}${path}`, { redirect: 'manual' })
    const location = response.headers.get('location') ?? ''
    let resolvedLocation = location
    try {
      resolvedLocation = new URL(location, check.sourceOrigin).toString()
    } catch {
      // The assertion below reports a missing or invalid Location header.
    }
    assert(
      response.status === 308,
      `${check.label} returned HTTP ${response.status}; expected permanent HTTP 308`,
    )
    assert(
      normalizedUrl(resolvedLocation) === normalizedUrl(`${check.canonicalOrigin}${path}`),
      `${check.label} redirects to ${location || 'nowhere'}; expected ${check.canonicalOrigin}${path}`,
    )
  }

  for (const [source, destination] of [
    [`${HUB_ORIGIN}/sitemap-gymnastics.xml`, `${HUB_ORIGIN}/sitemap.xml`],
    [`${GYMNASTICS_ORIGIN}/sitemap.xml`, `${GYMNASTICS_ORIGIN}/sitemap-gymnastics.xml`],
  ]) {
    const response = await fetch(source, { redirect: 'follow' })
    assert(response.ok, `${source}: sitemap consolidation returned HTTP ${response.status}`)
    assert(
      normalizedUrl(response.url) === normalizedUrl(destination),
      `${source}: resolved to ${response.url}; expected ${destination}`,
    )
  }

  const immutableAssets = [
    `${HUB_ORIGIN}/fonts/inter-latin-variable.woff2`,
    `${HUB_ORIGIN}/fonts/oswald-latin-variable.woff2`,
  ]
  for (const url of immutableAssets) {
    const response = await fetch(url, { redirect: 'follow' })
    const cacheControl = (response.headers.get('cache-control') ?? '').toLowerCase()
    assert(response.ok, `${url}: static asset returned HTTP ${response.status}`)
    assert(
      cacheControl.includes('max-age=31536000') && cacheControl.includes('immutable'),
      `${url}: expected one-year immutable caching, received ${cacheControl || 'no Cache-Control header'}`,
    )
  }

  for (const url of [
    `${HUB_ORIGIN}/vortex-athletics-og.jpg`,
    `${GYMNASTICS_ORIGIN}/vortex-gymnastics-og.jpg`,
  ]) {
    const response = await fetch(url, { redirect: 'follow' })
    const cacheControl = (response.headers.get('cache-control') ?? '').toLowerCase()
    assert(response.ok, `${url}: social image returned HTTP ${response.status}`)
    assert(!cacheControl.includes('no-store'), `${url}: public social image must not use no-store`)
  }
}

assert(
  !existsSync(join(root, 'public/robots.txt')),
  'public/robots.txt must not exist because it would bypass host-specific Vercel rewrites',
)
const genericRobots = readFileSync(join(root, 'public/robots-generic.txt'), 'utf8')
assert(!/^Sitemap:/mi.test(genericRobots), 'generic robots fallback must not advertise a cross-host sitemap')
assert(/^Disallow:\s*\/admin$/mi.test(genericRobots), 'generic robots fallback must disallow /admin')
assert(
  !/^Disallow:\s*\/\*\?sport=/mi.test(genericRobots),
  'generic robots fallback must leave noindex preview URLs crawlable',
)

const publicSitemapFiles = readdirSync(join(root, 'public'))
  .filter((file) => /^sitemap.*\.xml$/i.test(file))
  .sort()
const expectedPublicSitemapFiles = ['sitemap-gymnastics.xml', 'sitemap.xml']
assert(
  JSON.stringify(publicSitemapFiles) === JSON.stringify(expectedPublicSitemapFiles),
  `public/: unexpected sitemap copies found (${publicSitemapFiles.join(', ')})`,
)

const notFoundHtml = readFileSync(join(root, 'public/404.html'), 'utf8')
assert(titleValues(notFoundHtml).length === 1, 'public/404.html: expected exactly one title')
assert(h1Values(notFoundHtml).length === 1, 'public/404.html: expected exactly one H1')
assert(
  metaValues(notFoundHtml, 'name', 'robots').some((value) => /noindex/i.test(value)),
  'public/404.html: noindex robots directive is missing',
)

for (const stub of STUB_SEO_ENTRIES) {
  const file = join(root, 'dist', '_seo', `${stub.host}.html`)
  assert(existsSync(file), `${stub.host}: generated noindex HTML is missing (${file})`)
  if (existsSync(file)) {
    verifyHtml(stub.host, readFileSync(file, 'utf8'), stub.canonical, {
      shouldIndex: false,
      requireH1: false,
      requireSchema: false,
    })
  }
}

const vercelConfig = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
const redirects = vercelConfig.redirects ?? []
const headers = vercelConfig.headers ?? []
const rewrites = vercelConfig.rewrites ?? []
const redirectFor = (host, source, destination) =>
  redirects.some(
    (redirect) =>
      redirect.source === source &&
      redirect.destination === destination &&
      redirect.permanent === true &&
      redirect.has?.some((condition) => condition.type === 'host' && condition.value === host),
  )
assert(
  redirectFor('www.vortexathletics.com', '/:path*', `${HUB_ORIGIN}/:path*`),
  'vercel.json: www athletics canonical-host redirect is missing',
)
assert(
  redirectFor('vortex-gymnastics.com', '/:path*', `${GYMNASTICS_ORIGIN}/:path*`),
  'vercel.json: apex gymnastics canonical-host redirect is missing',
)
assert(
  !redirects.some((redirect) => redirect.destination?.startsWith('https://www.vortexathletics.com')),
  'vercel.json: a redirect still targets noncanonical www.vortexathletics.com',
)
assert(
  !redirects.some((redirect) => redirect.destination?.startsWith('https://vortex-gymnastics.com')),
  'vercel.json: a redirect still targets noncanonical apex vortex-gymnastics.com',
)
for (const [host, source, destination] of [
  ['vortexathletics.com', '/sitemap-gymnastics.xml', `${HUB_ORIGIN}/sitemap.xml`],
  ['www.vortexathletics.com', '/sitemap-gymnastics.xml', `${HUB_ORIGIN}/sitemap.xml`],
  ['vortex-gymnastics.com', '/sitemap.xml', `${GYMNASTICS_ORIGIN}/sitemap-gymnastics.xml`],
  ['www.vortex-gymnastics.com', '/sitemap.xml', `${GYMNASTICS_ORIGIN}/sitemap-gymnastics.xml`],
]) {
  assert(
    redirectFor(host, source, destination),
    `vercel.json: wrong-host sitemap ${host}${source} is not consolidated`,
  )
}
const robotsRouteFor = (host, dest) =>
  rewrites.some(
    (rewrite) =>
      rewrite.source === '/robots.txt' &&
      rewrite.destination === dest &&
      rewrite.has?.some((condition) => condition.type === 'host' && condition.value === host),
  )
assert(robotsRouteFor('vortexathletics.com', '/robots-hub.txt'), 'vercel.json: hub robots routing is missing')
assert(robotsRouteFor('www.vortex-gymnastics.com', '/robots-gymnastics.txt'), 'vercel.json: gymnastics robots routing is missing')
assert(
  rewrites.some(
    (rewrite) =>
      rewrite.source === '/robots.txt' &&
      rewrite.destination === '/robots-generic.txt' &&
      !rewrite.has,
  ),
  'vercel.json: generic robots fallback routing is missing',
)
assert(!vercelConfig.routes, 'vercel.json: legacy routes must not be mixed with redirects, headers, or rewrites')
const cacheHeaderValues = headers.flatMap((rule) =>
  (rule.headers ?? [])
    .filter((header) => header.key?.toLowerCase() === 'cache-control')
    .map((header) => ({ source: rule.source, value: header.value?.toLowerCase() ?? '' })),
)
assert(
  !cacheHeaderValues.some(({ value }) => /(?:^|,)\s*no-store\b/.test(value)),
  'vercel.json: public static content must not use no-store caching',
)
for (const source of ['/assets/(.*)', '/fonts/(.*)']) {
  assert(
    cacheHeaderValues.some(
      (header) =>
        header.source === source &&
        header.value.includes('max-age=31536000') &&
        header.value.includes('immutable'),
    ),
    `vercel.json: ${source} must use one-year immutable browser caching`,
  )
}

const spaOnlyPaths = [
  '/copy',
  '/signup/family',
  '/signup/invite',
  '/verify-email',
  '/registration/receipt',
  '/waivers-memberships',
  '/camp_interest',
  '/camp_interest/thank-you',
]
for (const path of spaOnlyPaths) {
  assert(
    rewrites.some(
      (rewrite) => rewrite.source === path && rewrite.destination === '/index.html',
    ),
    `vercel.json: client-only route ${path} is missing its explicit SPA rewrite`,
  )
}
assert(
  rewrites
    .filter((rewrite) => rewrite.destination === '/index.html')
    .every((rewrite) => spaOnlyPaths.includes(rewrite.source)),
  'vercel.json: catch-all SPA rewrite would turn unknown URLs into soft 404s',
)

if (failures.length) {
  console.error(`SEO release verification failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

const routeCount = expectedSets.reduce((total, set) => total + set.entries.length, 0)
const noindexCount = expectedSets.reduce((total, set) => total + set.noindexPaths.length, 0) + STUB_SEO_ENTRIES.length
console.log(
  `SEO release verification passed (${routeCount} indexable routes, ${noindexCount} noindex routes${live ? ', including live production' : ''}).`,
)
