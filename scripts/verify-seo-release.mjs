import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  BOWIE_YOUTH_SPORTS_GUIDE_PATH,
  GYMNASTICS_ORIGIN,
  HUB_NOINDEX_PRERENDER_PATHS,
  HUB_ORIGIN,
  HUB_PRERENDER_PATHS,
  HUB_PROGRAM_PATHS,
  HUB_SITEMAP_ENTRIES,
  SITE_NAME,
  SPA_ONLY_PATHS,
  SPA_SHELL_PATH,
  STUB_SEO_ENTRIES,
  YOUTH_ATHLETIC_GUIDE_PATH,
} from './seo-config.mjs'

const root = process.cwd()
const live = process.argv.includes('--live')
const legacyLandingRedirects = JSON.parse(
  readFileSync(join(root, 'src/config/publicLandingRedirects.json'), 'utf8'),
)
const unifiedHosts = new Set([HUB_ORIGIN, GYMNASTICS_ORIGIN]
  .map((origin) => new URL(origin).hostname.replace(/^www\./, '')))
const legacyDestinations = [...new Set(Object.values(legacyLandingRedirects))]
  .map((destination) => new URL(destination, HUB_ORIGIN))
const programActions = new Map([
  ['/gymnastics', { path: '/enroll', program: 'Developmental Gymnastics' }],
  ['/fit-and-flip', { path: '/enroll', program: 'Fit & Flip' }],
  ['/adult-gymnastics', { path: '/enroll', program: 'Adult Fitness & Acrobatics' }],
])
const hasAdultDropInLink = (links) => links.some((url) => url.origin === HUB_ORIGIN &&
  url.pathname === '/drop-in' && url.searchParams.get('program') === 'Adult Fitness & Acrobatics')
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
const snapshotAliasFor = (path) => `${path === '/' ? '' : path}/index.html`

const anchorUrls = (html) => tags(html, 'a')
  .map((tag) => attribute(tag, 'href'))
  .filter(Boolean)
  .map((href) => new URL(href, HUB_ORIGIN))

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
    lastmod: match[1].match(/<lastmod>(.*?)<\/lastmod>/)?.[1],
    lastmodCount: tags(match[1], 'lastmod').length,
  }))

const isCalendarDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function verifySitemapLastmod(label, xml, { origin, entries }) {
  const rows = new Map(extractSitemapRows(xml).map((row) => [row.loc, row]))
  for (const { path, lastmod } of entries) {
    const url = canonicalFor(origin, path)
    const row = rows.get(url)
    if (lastmod === undefined) {
      assert(row?.lastmodCount === 0, `${label}: ${url} should omit lastmod`)
    } else {
      assert(isCalendarDate(lastmod), `${label}: invalid configured lastmod for ${url}`)
      assert(row?.lastmodCount === 1 && row.lastmod === lastmod, `${label}: ${url} must have one lastmod of ${lastmod}`)
    }
  }
}

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
]

const distFileFor = (path) => {
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
  const rawVideoSources = [...html.matchAll(/<video\b[^>]*>[\s\S]*?<\/video>/gi)]
    .flatMap(([video]) => [...tags(video, 'video'), ...tags(video, 'source')])
    .map((tag) => attribute(tag, 'src'))
    .filter(Boolean)

  if (!label.startsWith('live ')) verifyLocalAssets(label, html)
  assert(!/\sdata-prerender-dynamic(?:=|\s|>)/i.test(html), `${label}: raw HTML contains live data or a temporary UI state`)
  assert(rawVideoSources.length === 0, `${label}: raw HTML would load a video before the app can defer playback`)

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
  const expectedSiteName = SITE_NAME
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

  const pageUrl = new URL(canonical)
  const pagePath = pageUrl.pathname
  if (pageUrl.origin === HUB_ORIGIN) {
    for (const url of anchorUrls(html)) {
      if (!unifiedHosts.has(url.hostname.replace(/^www\./, ''))) continue
      assert(!Object.hasOwn(legacyLandingRedirects, url.pathname.replace(/\/+$/, '').toLowerCase()),
        `${label}: link points to retired landing URL ${url.pathname}; use its destination directly`)
    }
  }
  const pageIds = new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]))
  const usesLegacyHeader = ['/contact', '/store', '/support', '/privacy-policy', '/terms-of-service'].includes(pagePath)
  if (shouldIndex && (usesLegacyHeader || [
    '/', ...HUB_PROGRAM_PATHS, '/read-board', '/enroll', '/drop-in',
    YOUTH_ATHLETIC_GUIDE_PATH, BOWIE_YOUTH_SPORTS_GUIDE_PATH,
  ].includes(pagePath))) {
    const navigation = html.match(/<nav\b[^>]*\baria-label=["']Main navigation["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] ?? ''
    const links = anchorUrls(navigation)
    const expectedPaths = [...HUB_PROGRAM_PATHS, BOWIE_YOUTH_SPORTS_GUIDE_PATH]
    if (!usesLegacyHeader) expectedPaths.push('/#programs')
    for (const path of expectedPaths) {
      assert(links.filter((url) => url.href === canonicalFor(HUB_ORIGIN, path)).length === 1,
        `${label}: expected one crawlable main navigation link to ${path}`)
    }
    if (usesLegacyHeader) {
      const footer = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i)?.[0] ?? ''
      const footerLinks = anchorUrls(footer)
      for (const path of HUB_PROGRAM_PATHS) {
        assert(footerLinks.filter((url) => url.href === canonicalFor(HUB_ORIGIN, path)).length === 1,
          `${label}: expected one crawlable footer link to ${path}`)
      }

      const header = html.match(/<header\b[^>]*>[\s\S]*?<\/header>/i)?.[0] ?? ''
      const chromeLinks = [...anchorUrls(header), ...footerLinks]
      assert(!chromeLinks.some((url) => STUB_SEO_ENTRIES.some(({ host }) => url.hostname.replace(/^www\./, '') === host)),
        `${label}: header or footer links to a placeholder sport domain`)
      for (const path of ['/#gymnastics', '/#fit-flip']) {
        assert(!chromeLinks.some((url) => url.href === canonicalFor(HUB_ORIGIN, path)),
          `${label}: header or footer links to superseded program entry ${path}`)
      }
    }
  }
  if (pagePath === '/' && shouldIndex) {
    assert(h1s[0] === 'Built for more.', `${label}: the primary homepage must render the new unified design`)
    assert(/id=["']free-trial["']/.test(html), `${label}: the primary homepage is missing free-trial signup`)
    assert(/THE TRIAD OF ATHLETICISM/.test(html), `${label}: the primary homepage is missing the athleticism triad`)
    const pageLinks = anchorUrls(html)
    for (const path of ['/enroll', '/drop-in', '/store', '/contact']) {
      assert(pageLinks.some((url) => url.href === canonicalFor(HUB_ORIGIN, path)),
        `${label}: missing a crawlable link to ${path}`)
    }
    for (const id of ['gymnastics', 'fit-flip']) {
      assert(pageIds.has(id), `${label}: missing homepage section #${id}`)
    }
  }

  if (shouldIndex && ['/contact', '/drop-in'].includes(pagePath)) {
    const introduction = [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/gi)]
      .find(([section]) => /<h1\b/i.test(section))?.[0] ?? ''
    const links = anchorUrls(introduction)
    for (const path of HUB_PROGRAM_PATHS) {
      assert(links.some((url) => url.href === canonicalFor(HUB_ORIGIN, path)),
        `${label}: missing a crawlable program link to ${path} near the main heading`)
    }
    if (pagePath === '/drop-in') {
      assert(hasAdultDropInLink(links), `${label}: missing a link to adult drop-in dates near the main heading`)
    }
  }

  if (shouldIndex && pagePath === '/enroll') {
    const classSelection = html.match(/<section\b[^>]*\baria-labelledby=["']enrollment-class-selection["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const links = anchorUrls(classSelection)
    for (const path of HUB_PROGRAM_PATHS) {
      assert(links.filter((url) => url.href === canonicalFor(HUB_ORIGIN, path)).length === 1,
        `${label}: expected one crawlable class-selection link to ${path}`)
    }
  }

  if (shouldIndex && (pagePath === '/' || HUB_PROGRAM_PATHS.includes(pagePath))) {
    const mainHtml = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] ?? ''
    const mainLinks = anchorUrls(mainHtml)
    if (pagePath === '/gymnastics') {
      const firstVisit = mainHtml.match(/<section\b[^>]*\sid=["']first-visit["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      assert(/<h2\b[^>]*>What to expect at your child’s first gymnastics class<\/h2>/i.test(firstVisit),
        `${label}: missing the first gymnastics visit section`)
      assert(/<h3\b[^>]*>What should my child wear to class\?<\/h3>/i.test(firstVisit) &&
        /parent or legal guardian/i.test(firstVisit), `${label}: missing first-visit attire or guardian guidance`)
      assert(anchorUrls(firstVisit).some((url) => url.href === `${HUB_ORIGIN}/#free-trial`),
        `${label}: missing the trial finder link in the first visit section`)
    }
    if (pagePath === '/fit-and-flip') {
      const speedAgility = mainHtml.match(/<article\b[^>]*\sid=["']speed-agility["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
      assert(/<h3\b[^>]*>Speed and agility for youth sports<\/h3>/i.test(speedAgility),
        `${label}: missing the crawlable speed and agility heading at #speed-agility`)
    }
    if (pagePath === '/adult-gymnastics') {
      assert(hasAdultDropInLink(mainLinks), `${label}: missing a crawlable link for single-class adult bookings`)
    }
    if (pagePath === '/') {
      for (const path of HUB_PROGRAM_PATHS) {
        assert(mainLinks.some((url) => url.href === canonicalFor(HUB_ORIGIN, path)),
          `${label}: missing a crawlable program link to ${path} in main content`)
      }
    } else {
      const action = programActions.get(pagePath)
      assert(
        action && mainLinks.some((url) =>
          url.origin === HUB_ORIGIN && url.pathname === action.path &&
          (!action.program || url.searchParams.get('program') === action.program)),
        `${label}: missing a crawlable ${action?.path ?? 'program action'} link in main content`,
      )
    }
  }

  if (shouldIndex) {
    for (const { hash } of legacyDestinations.filter(({ pathname, hash }) => pathname === pagePath && hash)) {
      assert(pageIds.has(hash.slice(1)), `${label}: a legacy redirect points to missing section ${hash}`)
    }
  }

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

  const guideCanonical = canonicalFor(HUB_ORIGIN, YOUTH_ATHLETIC_GUIDE_PATH)
  const bowieGuideCanonical = canonicalFor(HUB_ORIGIN, BOWIE_YOUTH_SPORTS_GUIDE_PATH)
  const fitAndFlipCanonical = canonicalFor(HUB_ORIGIN, '/fit-and-flip')
  if (shouldIndex && [HUB_ORIGIN, guideCanonical, fitAndFlipCanonical].includes(canonical)) {
    const content = (canonical === guideCanonical
      ? html.match(/<article\b[^>]*>[\s\S]*?<\/article>/i)
      : html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i))?.[0] ?? ''
    const links = anchorUrls(content)
    if (canonical !== guideCanonical) {
      assert(links.some((url) => url.href === guideCanonical),
        `${label}: missing the crawlable youth athletic development guide link in main content`)
    } else {
      assert(links.some((url) => url.href === fitAndFlipCanonical),
        `${label}: missing a crawlable link from the guide to the Fit & Flip program page`)
      assert(
        links.some((url) =>
          url.origin === HUB_ORIGIN &&
          ((url.pathname === '/enroll' && url.searchParams.get('program') === 'Fit & Flip') ||
            (url.pathname === '/' && url.hash === '#free-trial'))),
        `${label}: missing a crawlable link from the guide to Fit & Flip enrollment or a free trial`,
      )
    }
  }

  if (shouldIndex && pagePath === '/read-board') {
    const introduction = [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/gi)]
      .find(([section]) => /<h1\b/i.test(section))?.[0] ?? ''
    assert(anchorUrls(introduction).some((url) => url.href === bowieGuideCanonical),
      `${label}: missing the crawlable Bowie youth sports guide link near the main heading`)
    const viewLinks = anchorUrls(introduction.match(/<nav\b[^>]*\baria-label=["']Browse classes and updates["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] ?? '')
    for (const hash of ['#classes', '#schedule', '#events', '#highlights']) {
      assert(viewLinks.some((url) => url.href === `${HUB_ORIGIN}/read-board${hash}`) && pageIds.has(hash.slice(1)),
        `${label}: missing a working static link for ${hash}`)
    }
    const schedule = html.match(/<section\b[^>]*\sid=["']schedule["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    assert(/<h2\b[^>]*>Class schedule in Bowie, MD<\/h2>/i.test(schedule),
      `${label}: missing the static class schedule heading`)
    const bookingLinks = anchorUrls(schedule)
    for (const path of ['/#free-trial', '/enroll', '/drop-in', '/adult-gymnastics']) {
      assert(bookingLinks.some((url) => url.href === `${HUB_ORIGIN}${path}`),
        `${label}: missing a static schedule link to ${path}`)
    }
  }
  if (shouldIndex && canonical === bowieGuideCanonical) {
    const content = html.match(/<article\b[^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
    const links = anchorUrls(content)
    for (const path of ['/gymnastics', '/gymnastics#first-visit', '/fit-and-flip', '/read-board', YOUTH_ATHLETIC_GUIDE_PATH]) {
      assert(links.some((url) => url.href === canonicalFor(HUB_ORIGIN, path)),
        `${label}: missing the crawlable guide link to ${path}`)
    }
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

    if (canonical === guideCanonical || canonical === bowieGuideCanonical) {
      const article = parsed.find((item) => item?.['@type'] === 'Article')
      assert(article?.mainEntityOfPage === canonical && article?.headline === h1s[0],
        `${label}: Article JSON-LD must match the canonical URL and visible heading`)
      const visibleDates = tags(html, 'time').map((tag) => attribute(tag, 'datetime'))
      const sitemapDate = HUB_SITEMAP_ENTRIES.find(({ path }) => path === pagePath)?.lastmod
      assert(isCalendarDate(article?.datePublished) && isCalendarDate(article?.dateModified) && article.datePublished <= article.dateModified,
        `${label}: Article JSON-LD must have a publication date on or before the update date`)
      assert(article?.dateModified === sitemapDate && [article?.datePublished, article?.dateModified].every((date) => visibleDates.includes(date)),
        `${label}: Article dates must match the visible dates and sitemap update date`)
    }

    if (
      normalizedUrl(canonical) === normalizedUrl(HUB_ORIGIN)
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
  const expectedUrls = set.entries.map(({ path }) => canonicalFor(set.origin, path))

  assert(actualUrls.length === expectedUrls.length, `${set.label} sitemap: found ${actualUrls.length}, expected ${expectedUrls.length}`)
  assert(new Set(actualUrls).size === actualUrls.length, `${set.label} sitemap: duplicate URLs found`)
  assert(expectedUrls.every((url) => actualUrls.includes(url)), `${set.label} sitemap: URL set differs from SEO configuration`)
  verifySitemapLastmod(`${set.label} sitemap`, xml, set)
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
    const file = distFileFor(entry.path)
    assert(existsSync(file), `${set.label}${entry.path}: prerendered file is missing (${file})`)
    if (existsSync(file)) verifyHtml(`${set.label}${entry.path}`, readFileSync(file, 'utf8'), canonical)
  }

  for (const path of set.noindexPaths) {
    const canonical = canonicalFor(set.origin, path)
    const file = distFileFor(path)
    assert(existsSync(file), `${set.label}${path}: noindex prerender is missing (${file})`)
    if (existsSync(file)) {
      verifyHtml(`${set.label}${path}`, readFileSync(file, 'utf8'), canonical, { shouldIndex: false })
    }
  }

  const hostRobots = readFileSync(join(root, set.robotsPath), 'utf8')
  assert(
    !/^Disallow:\s*\S+/mi.test(hostRobots),
    `${set.robotsPath}: noindex URLs must remain crawlable so search engines can see noindex`,
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
      const remoteXml = await sitemapResponse.text()
      const remoteUrls = extractUrls(remoteXml)
      assert(
        remoteUrls.length === expectedUrls.length && expectedUrls.every((url) => remoteUrls.includes(url)),
        `${set.label} live sitemap does not match the release sitemap`,
      )
      verifySitemapLastmod(`${set.label} live sitemap`, remoteXml, set)
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
        !/^Disallow:\s*\S+/mi.test(remoteRobots),
        `${set.label} live robots.txt blocks noindex URLs from exposing their directive`,
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
      assert(!/\bnoindex\b/i.test(response.headers.get('x-robots-tag') ?? ''), `${canonical}: HTTP headers contain noindex`)
      verifyHtml(`live ${canonical}`, await response.text(), canonical)
    }

    for (const path of ['/admin', '/?sport=soccer', ...SPA_ONLY_PATHS]) {
      const response = await fetch(`${set.origin}${path}`, { redirect: 'follow' })
      if (path === '/admin' && response.status === 404) continue
      assert(response.ok, `${path}: returned HTTP ${response.status}`)
      if (path === '/?sport=soccer') {
        assert(response.url === `${set.origin}${path}`, `${path}: redirect changed the sport preview URL`)
      }
      const headers = response.headers.get('x-robots-tag') ?? ''
      const robots = metaValues(await response.text(), 'name', 'robots')
      assert(/\bnoindex\b/i.test(headers) || robots.some((value) => /\bnoindex\b/i.test(value)),
        `${path}: expected a noindex directive before JavaScript runs`)
    }

    const notFoundUrl = `${set.origin}/__seo-release-404-check__`
    const notFoundResponse = await fetch(notFoundUrl, { redirect: 'manual' })
    assert(
      notFoundResponse.status === 404,
      `${set.label} unknown route returned HTTP ${notFoundResponse.status}; expected a real 404`,
    )
    // A platform 404 can have a plain-text body. Check the branded HTML
    // separately because it is also reachable directly as a static file.
    const brandedNotFound = await fetch(`${set.origin}/404.html`, { redirect: 'manual' })
    assert(
      brandedNotFound.ok || brandedNotFound.status === 404,
      `${set.label} live /404.html returned HTTP ${brandedNotFound.status}`,
    )
    assert(
      (brandedNotFound.headers.get('content-type') ?? '').includes('text/html') &&
      metaValues(await brandedNotFound.text(), 'name', 'robots').some((value) => /\bnoindex\b/i.test(value)),
      `${set.label} live branded /404.html is missing HTML noindex`,
    )
  }
}

if (live) {
  const athleticsWwwOrigin = 'https://www.vortexathletics.com'
  const gymnasticsApexOrigin = 'https://vortex-gymnastics.com'
  const hostAliases = new Map([
    [gymnasticsApexOrigin, GYMNASTICS_ORIGIN],
    [athleticsWwwOrigin, HUB_ORIGIN],
  ])

  const verifyLiveRedirect = async (source, destination) => {
    let current = source
    for (let hop = 0; hop < 3; hop += 1) {
      const response = await fetch(current, { redirect: 'manual' })
      const location = response.headers.get('location')
      let next
      try {
        if (!location) throw new Error('Missing Location')
        next = new URL(location, current)
      } catch {
        assert(false, `${source.href}: ${current.href} returned HTTP ${response.status} without a valid Location header`)
        return
      }

      const permanent = response.status === 301 || response.status === 308
      if (next.href === destination.href) {
        assert(permanent, `${source.href}: final redirect returned HTTP ${response.status}; expected HTTP 301 or 308`)
        return
      }

      const aliasOrigin = hostAliases.get(current.origin)
      const aliasTarget = aliasOrigin && new URL(current.pathname + current.search + current.hash, aliasOrigin)
      const temporaryGymnasticsAlias = current.origin === gymnasticsApexOrigin && response.status === 307
      const aliasRedirect = next.href === aliasTarget?.href && (permanent || temporaryGymnasticsAlias)
      const slashlessTarget = new URL(current)
      slashlessTarget.pathname = current.pathname.replace(/\/$/, '')
      const slashRedirect = permanent && slashlessTarget.href !== current.href && next.href === slashlessTarget.href
      if (!aliasRedirect && !slashRedirect) {
        assert(false, `${source.href}: ${current.href} redirected to ${next.href} (HTTP ${response.status}); expected ${destination.href}`)
        return
      }
      current = next
    }

    assert(false, `${source.href}: did not reach ${destination.href} within three redirects`)
  }

  const aliasOrigins = [athleticsWwwOrigin, gymnasticsApexOrigin, GYMNASTICS_ORIGIN]
  const hostCheckPath = '/__seo-host-redirect-check__'
  for (const origin of aliasOrigins) {
    await verifyLiveRedirect(new URL(hostCheckPath, origin), new URL(hostCheckPath, HUB_ORIGIN))
  }

  for (const origin of [gymnasticsApexOrigin, GYMNASTICS_ORIGIN]) {
    await verifyLiveRedirect(new URL(origin), new URL(HUB_ORIGIN))
  }

  const verifyTrackedRedirect = async (path, target) => {
    const destination = new URL(target, HUB_ORIGIN)
    destination.searchParams.set('utm_source', 'seo-release-check')
    for (const origin of [HUB_ORIGIN, ...aliasOrigins]) {
      const source = new URL(path, origin)
      source.search = destination.search
      await verifyLiveRedirect(source, destination)
    }
  }

  for (const path of [
    '/vortex-athletics',
    '/athleticism-accelerator',
    '/summer-athletic-training',
    '/artistic-gymnastics-6-12',
    '/campaigns/artistic-gymnastics-6-12',
    '/trampoline-tumbling',
  ]) {
    await verifyTrackedRedirect(path, legacyLandingRedirects[path])
    await verifyTrackedRedirect(`${path}/`, legacyLandingRedirects[path])
  }

  for (const path of [...HUB_PROGRAM_PATHS, YOUTH_ATHLETIC_GUIDE_PATH, BOWIE_YOUTH_SPORTS_GUIDE_PATH]) {
    await verifyTrackedRedirect(`${path}/`, path)
  }

  await Promise.all(HUB_PRERENDER_PATHS.map((path) => verifyTrackedRedirect(snapshotAliasFor(path), path)))
  for (const path of ['/__seo-release-404-check__/index.html', '/gymnastics/indexXhtml']) {
    const response = await fetch(new URL(path, HUB_ORIGIN), { redirect: 'manual' })
    assert(response.status === 404, `${path}: expected HTTP 404 for an unknown snapshot file, received ${response.status}`)
  }

  for (const [source, destination] of [
    [`${HUB_ORIGIN}/sitemap-gymnastics.xml`, `${HUB_ORIGIN}/sitemap.xml`],
    [`${GYMNASTICS_ORIGIN}/sitemap.xml`, `${HUB_ORIGIN}/sitemap.xml`],
    [`${GYMNASTICS_ORIGIN}/sitemap-gymnastics.xml`, `${HUB_ORIGIN}/sitemap.xml`],
    ['https://vortex-gymnastics.com/sitemap.xml', `${HUB_ORIGIN}/sitemap.xml`],
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
    `${HUB_ORIGIN}/vortex-gymnastics-og.jpg`,
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
assert(
  !/^Disallow:\s*\S+/mi.test(genericRobots),
  'generic robots fallback must leave noindex URLs crawlable',
)

const publicSitemapFiles = readdirSync(join(root, 'public'))
  .filter((file) => /^sitemap.*\.xml$/i.test(file))
  .sort()
const expectedPublicSitemapFiles = ['sitemap.xml']
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
assert(vercelConfig.trailingSlash === false,
  'vercel.json: trailing-slash variants must permanently redirect to the canonical slashless paths')
const redirects = vercelConfig.redirects ?? []
const headers = vercelConfig.headers ?? []
const rewrites = vercelConfig.rewrites ?? []
const redirectFor = (host, source, destination) =>
  redirects.some(
    (redirect) =>
      redirect.source === source &&
      redirect.destination === destination &&
      redirect.permanent === true &&
      redirect.has?.some((condition) => condition.type === 'host' && new RegExp(`^(?:${condition.value})$`).test(host)),
  )
const hubPages = HUB_PRERENDER_PATHS.filter((path) => /^\/[^/]+$/.test(path)).map((path) => path.slice(1))
const hubArticles = HUB_PRERENDER_PATHS.filter((path) => path.startsWith('/blog/')).map((path) => path.slice('/blog/'.length))
const snapshotRedirectRules = [
  [snapshotAliasFor('/'), '/'],
  [snapshotAliasFor(`/:page(${hubPages.join('|')})`), '/:page'],
  [snapshotAliasFor(`/blog/:article(${hubArticles.join('|')})`), '/blog/:article'],
]
for (const [source, destination] of snapshotRedirectRules) {
  for (const host of ['vortexathletics.com', 'www.vortexathletics.com', 'vortex-gymnastics.com', 'www.vortex-gymnastics.com']) {
    assert(redirectFor(host, source, `${HUB_ORIGIN}${destination}`),
      `vercel.json: missing permanent snapshot redirect from ${host}${source} to ${destination}`)
  }
}
const hasNoindexHeader = (rule) => (rule.headers ?? []).some((header) =>
  header.key?.toLowerCase() === 'x-robots-tag' && /\bnoindex\b/i.test(header.value ?? ''),
)
for (const [source, path] of Object.entries(legacyLandingRedirects)) {
  const destination = new URL(path, HUB_ORIGIN)
  assert(
    destination.origin === HUB_ORIGIN &&
    (HUB_PRERENDER_PATHS.includes(destination.pathname) || SPA_ONLY_PATHS.includes(destination.pathname)),
    `${source}: legacy destination ${destination.href} is not a public route`,
  )
  for (const host of ['vortexathletics.com', 'www.vortexathletics.com', 'vortex-gymnastics.com', 'www.vortex-gymnastics.com']) {
    assert(redirectFor(host, source, destination.href), `vercel.json: missing permanent redirect from ${host}${source} to ${destination.href}`)
  }
}
for (const path of HUB_PROGRAM_PATHS) {
  assert(!Object.hasOwn(legacyLandingRedirects, path),
    `${path}: an active program page must not remain in the client-side legacy redirects`)
  assert(!redirects.some((rule) => {
    const host = rule.has?.find((condition) => condition.type === 'host')
    return rule.source === path && (!host || new RegExp(`^(?:${host.value})$`).test(new URL(HUB_ORIGIN).host))
  }), `vercel.json: ${path} must serve its program page on the canonical host`)
}
assert(
  headers.some(rule => rule.source === '/:path*' && hasNoindexHeader(rule) &&
    rule.has?.some(condition => condition.type === 'query' && condition.key === 'sport')),
  'vercel.json: public URLs with a sport preview query must have a noindex header',
)
const matchesRootSportPreview = (rule) => rule.source === '/' &&
  rule.has?.some(condition => condition.type === 'query' && condition.key === 'sport' && condition.value === '.+')
assert(
  headers.some(rule => matchesRootSportPreview(rule) && hasNoindexHeader(rule)),
  'vercel.json: the root sport preview must have a noindex header even when the filesystem serves the homepage',
)
for (const source of ['/admin', '/admin.html', '/employee/payroll/:path*']) {
  assert(headers.some(rule => rule.source === source && hasNoindexHeader(rule)),
    `vercel.json: ${source} must have a noindex header`)
}
assert(
  redirectFor('www.vortexathletics.com', '/:path*', `${HUB_ORIGIN}/:path*`),
  'vercel.json: www athletics canonical-host redirect is missing',
)
assert(
  ['vortex-gymnastics.com', 'www.vortex-gymnastics.com'].every(host => redirectFor(host, '/:path*', `${HUB_ORIGIN}/:path*`)),
  'vercel.json: both gymnastics hosts must redirect to the primary website',
)
assert(
  !redirects.some((redirect) => redirect.destination?.startsWith('https://www.vortexathletics.com')),
  'vercel.json: a redirect still targets noncanonical www.vortexathletics.com',
)
assert(
  !redirects.some((redirect) => /^https:\/\/(?:www\.)?vortex-gymnastics\.com/.test(redirect.destination ?? '')),
  'vercel.json: a redirect still targets the retired gymnastics website',
)
for (const [host, source, destination] of [
  ['vortexathletics.com', '/sitemap-gymnastics.xml', `${HUB_ORIGIN}/sitemap.xml`],
  ['www.vortexathletics.com', '/sitemap-gymnastics.xml', `${HUB_ORIGIN}/sitemap.xml`],
  ['vortex-gymnastics.com', '/sitemap-gymnastics.xml', `${HUB_ORIGIN}/sitemap.xml`],
  ['www.vortex-gymnastics.com', '/sitemap-gymnastics.xml', `${HUB_ORIGIN}/sitemap.xml`],
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
      rewrite.has?.some((condition) => condition.type === 'host' && new RegExp(`^(?:${condition.value})$`).test(host)),
  )
assert(robotsRouteFor('vortexathletics.com', '/robots-hub.txt'), 'vercel.json: hub robots routing is missing')
assert(!rewrites.some(rewrite => /(?:_gym|robots-gymnastics)/.test(rewrite.destination ?? '')), 'vercel.json: retired gymnastics HTML/robots rewrites must be removed')
assert(!existsSync(join(root, 'public/robots-gymnastics.txt')), 'public/: retired gymnastics robots file remains')
assert(!existsSync(join(root, 'dist/_gym')), 'dist/: retired gymnastics snapshots remain')
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

const shellFile = join(root, 'dist', SPA_SHELL_PATH)
assert(existsSync(shellFile), `dist: missing client-only shell ${SPA_SHELL_PATH}`)
if (existsSync(shellFile)) {
  const shell = readFileSync(shellFile, 'utf8')
  assert(metaValues(shell, 'name', 'robots').some(value => /\bnoindex\b/i.test(value)),
    'client-only shell: noindex meta is missing')
  assert(linkValues(shell, 'canonical').length === 0 && h1Values(shell).length === 0 && jsonLdValues(shell).length === 0,
    'client-only shell: inherited crawlable page content or metadata')
  assert(tags(shell, 'script').some(tag => attribute(tag, 'type') === 'module' && attribute(tag, 'src')),
    'client-only shell: application script is missing')
}
assert(!rewrites.some(rewrite => rewrite.destination === '/index.html'), 'vercel.json: do not rewrite client-only URLs to the indexable homepage')
for (const path of HUB_PRERENDER_PATHS.filter(path => path !== '/')) {
  assert(rewrites.some(rewrite => rewrite.source === path && rewrite.destination === `${path}/index.html`),
    `vercel.json: ${path} must serve its own prerendered page`)
}
for (const path of SPA_ONLY_PATHS) {
  assert(
    rewrites.some(
      (rewrite) => rewrite.source === path && rewrite.destination === SPA_SHELL_PATH,
    ),
    `vercel.json: client-only route ${path} is missing its explicit SPA rewrite`,
  )
}
const rootRewrite = rewrites.find(rule => rule.source === '/')
assert(
  rootRewrite && matchesRootSportPreview(rootRewrite) && rootRewrite.destination === SPA_SHELL_PATH,
  'vercel.json: the first root rewrite must route sport previews to the noindex shell',
)
for (const rewrite of rewrites.filter((rewrite) => rewrite.destination === SPA_SHELL_PATH)) {
  assert(
    rewrite === rootRewrite || SPA_ONLY_PATHS.includes(rewrite.source),
    `vercel.json: unexpected SPA rewrite ${rewrite.source}; only explicit client-only routes are allowed to prevent soft 404s`,
  )
}

if (failures.length) {
  console.error(`SEO release verification failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

const routeCount = expectedSets.reduce((total, set) => total + set.entries.length, 0)
const noindexCount = expectedSets.reduce((total, set) => total + set.noindexPaths.length, 0) +
  STUB_SEO_ENTRIES.length + SPA_ONLY_PATHS.length
console.log(
  `SEO release verification passed (${routeCount} indexable routes, ${noindexCount} noindex routes${live ? ', including live production' : ''}).`,
)
