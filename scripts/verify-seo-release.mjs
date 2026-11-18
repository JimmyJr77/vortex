import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PUBLIC_EDITORIAL_PAGES } from '../backend/analytics/eventContract.js'
import {
  BOWIE_YOUTH_SPORTS_GUIDE_PATH,
  getIndexNowVerificationKey,
  GYMNASTICS_ORIGIN,
  GYMNASTICS_VS_TUMBLING_GUIDE_PATH,
  HOME_PREFERRED_PHOTO,
  HOME_ROTATING_SITEMAP_PHOTOS,
  HUB_ARTICLE_PATHS,
  HUB_GUIDE_INDEX_PATH,
  HUB_LEGACY_CHROME_PATHS,
  HUB_NOINDEX_PRERENDER_PATHS,
  HUB_ORIGIN,
  HUB_PRERENDER_PATHS,
  HUB_PROGRAM_PATHS,
  HUB_SITEMAP_ENTRIES,
  IMAGE_SITEMAP_NAMESPACE,
  PRESCHOOL_GYMNASTICS_GUIDE_PATH,
  PUBLIC_TRAINING_VIDEO,
  RETIRED_GYMNASTICS_HOST_SNAPSHOT_REDIRECTS,
  RETIRED_LANDING_SNAPSHOT_PATHS,
  RETURNING_TO_GYMNASTICS_GUIDE_PATH,
  SITE_NAME,
  SPA_ONLY_PATHS,
  SPA_SHELL_PATH,
  STUB_SEO_ENTRIES,
  VIDEO_SITEMAP_NAMESPACE,
  YOUTH_ATHLETIC_GUIDE_PATH,
} from './seo-config.mjs'

const root = process.cwd()
const live = process.argv.includes('--live')
const legacyLandingRedirects = JSON.parse(
  readFileSync(join(root, 'src/config/publicLandingRedirects.json'), 'utf8'),
)
const { fitAndFlip, fitAndFlipSrcSet, fitAndFlipPreview } = JSON.parse(
  readFileSync(join(root, 'src/config/publicSearchPhotos.json'), 'utf8'),
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
const hasDropInProgramLink = (links, program) => links.some((url) => url.origin === HUB_ORIGIN &&
  url.pathname === '/drop-in' && url.searchParams.get('program') === program)
const galleryUrl = `${HUB_ORIGIN}/contact#inside-the-gym`
const accessibilityUrl = `${HUB_ORIGIN}/contact#parking-and-accessibility`
const watchUrl = `${HUB_ORIGIN}${PUBLIC_TRAINING_VIDEO.path}`
const videoUrl = `${HUB_ORIGIN}${PUBLIC_TRAINING_VIDEO.assetPath}`
const videoThumbnailUrl = `${HUB_ORIGIN}${PUBLIC_TRAINING_VIDEO.thumbnail}`
const homePreviewUrl = `${HUB_ORIGIN}${HOME_PREFERRED_PHOTO.src}`
const fitAndFlipPreviewUrl = `${HUB_ORIGIN}${fitAndFlipPreview}`
const fitAndFlipPreviewPaths = ['/fit-and-flip', BOWIE_YOUTH_SPORTS_GUIDE_PATH]
const videoDescriptionsPath = '/newpage/training-film-descriptions.vtt'
const isBowieDirections = (url) => url.origin === 'https://www.google.com' && url.pathname === '/maps/dir/' &&
  url.searchParams.get('api') === '1' && url.searchParams.get('destination_place_id') === 'ChIJZ4XjEwDtt4kRpTDa0qGHztM' &&
  url.searchParams.get('destination') === '4961 Tesla Dr Suite E, Bowie, MD 20715'
const publicServicePaths = [...HUB_PROGRAM_PATHS, '/drop-in']
const consentQueryParam = 'vcid'
const normalizedConsentPaths = ['/gymnastics', '/fit-and-flip', '/read-board', '/drop-in', '/contact', '/support']
const legacyNormalizedConsentPaths = Object.entries(legacyLandingRedirects)
  .filter(([, destination]) => normalizedConsentPaths.includes(new URL(destination, HUB_ORIGIN).pathname))
const consentVariantPaths = ['/', ...HUB_PROGRAM_PATHS.filter(path => !normalizedConsentPaths.includes(path)), '/terms-of-service']
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
const retiredSnapshotRoutes = [
  ...RETIRED_LANDING_SNAPSHOT_PATHS.map(path => [snapshotAliasFor(path), legacyLandingRedirects[path]]),
  ...Object.entries(RETIRED_GYMNASTICS_HOST_SNAPSHOT_REDIRECTS),
]

const anchorUrls = (html) => tags(html, 'a')
  .map((tag) => attribute(tag, 'href'))
  .filter(Boolean)
  .map((href) => new URL(href, HUB_ORIGIN))

const hasProgramTrialLink = (html, section) => {
  const anchor = `open-free-trial-${section}`
  return tags(html, 'a').some(tag => attribute(tag, 'href') === `#${anchor}` &&
    attribute(tag, 'id') === anchor && attribute(tag, 'aria-haspopup') === 'dialog' &&
    attribute(tag, 'data-analytics-cta') === 'free_trial' &&
    attribute(tag, 'data-analytics-section') === section.replaceAll('-', '_'))
}

const verifyPublicNotFoundHtml = (label, html) => {
  assert(titleValues(html).length === 1 && h1Values(html).length === 1,
    `${label}: expected one title and one H1`)
  assert(metaValues(html, 'name', 'robots').some((value) => /\bnoindex\b/i.test(value)),
    `${label}: expected an HTML noindex directive`)
  const links = anchorUrls(html)
  for (const path of HUB_PROGRAM_PATHS) {
    assert(links.some((link) => link.href === canonicalFor(HUB_ORIGIN, path)),
      `${label}: missing a direct recovery link to ${path}`)
  }
  assert(links.every((link) => link.origin === HUB_ORIGIN),
    `${label}: recovery links must stay on the canonical host`)
}

const verifyLocalAssets = (label, html) => {
  const candidates = [
    ...tags(html, 'img').flatMap((tag) => [attribute(tag, 'src'), attribute(tag, 'srcset')]),
    ...tags(html, 'source').map((tag) => attribute(tag, 'srcset')),
    ...tags(html, 'video').map((tag) => attribute(tag, 'poster')),
    ...metaValues(html, 'property', 'og:image'),
    ...tags(html, 'link')
      .filter((tag) => ['image', 'font'].includes(attribute(tag, 'as').toLowerCase()))
      .flatMap((tag) => [attribute(tag, 'href'), attribute(tag, 'imagesrcset')]),
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
    images: [...match[1].matchAll(/<image:image>\s*<image:loc>(.*?)<\/image:loc>\s*<\/image:image>/g)]
      .map((image) => decodeHtml(image[1])),
    videos: [...match[1].matchAll(/<video:video>([\s\S]*?)<\/video:video>/g)].map((video) => video[1]),
  }))

const isCalendarDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function verifyYouthBookingSummary(label, schedule, { path, program }) {
  const summary = schedule.match(/<div\b[^>]*\sid=["']youth-booking-summary["'][^>]*>[\s\S]*?<\/div>/i)?.[0]
  assert(summary, `${label}: the youth booking summary must be inside its program schedule`)
  if (!summary) return

  const checkTime = summary.match(/\bCatalog checked\s+(<time\b[^>]*>)/i)?.[1] ?? ''
  assert(isCalendarDate(attribute(checkTime, 'datetime')),
    `${label}: the youth booking summary must show a valid catalog check date`)

  const classHeadings = [...summary.matchAll(/<h4\b[^>]*>[\s\S]*?<\/h4>/gi)]
  assert(classHeadings.length > 0 && classHeadings.every(([heading]) => {
    const links = anchorUrls(heading)
    const url = links[0]
    const form = url?.searchParams.get('form') ?? ''
    return links.length === 1 && url.origin === HUB_ORIGIN && url.pathname === path &&
      url.searchParams.get('program') === program && /^[1-9]\d*$/.test(form) && Number.isSafeInteger(Number(form))
  }), `${label}: every youth booking class must link to its published enrollment form in ${program}`)
  const excludedDropIns = [...summary.matchAll(/<dt\b[^>]*>\s*Nonmember drop-in\s*<\/dt>\s*<dd\b[^>]*>\s*Unavailable\s*<\/dd>/gi)].length
  assert(hasDropInProgramLink(anchorUrls(summary), program) || excludedDropIns === classHeadings.length,
    `${label}: the youth booking summary must link to the ${program} drop-in calendar when classes accept drop-ins`)

  const monthlyAmounts = [...summary.matchAll(/<dt\b[^>]*>\s*Base monthly tuition\s*<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)]
  if (monthlyAmounts.some(([, amount]) => /\$\d/.test(amount))) {
    assert(/Paid monthly enrollment requires an active annual membership/i.test(summary),
      `${label}: the youth booking summary must explain the annual membership requirement for monthly tuition`)
  }

  const visibleText = decodeHtml(summary.replace(/<[^>]*>/g, ' '))
  if (/\b\d{1,2}:\d{2}\b/.test(visibleText)) {
    assert(/\bEastern\b/.test(visibleText), `${label}: the youth booking summary must identify class times as Eastern`)
  }
}

function verifySitemapEntries(label, xml, { origin, entries }) {
  const rows = new Map(extractSitemapRows(xml).map((row) => [row.loc, row]))
  assert(attribute(tags(xml, 'urlset')[0] ?? '', 'xmlns:image') === IMAGE_SITEMAP_NAMESPACE,
    `${label}: missing the Google image sitemap namespace`)
  assert(attribute(tags(xml, 'urlset')[0] ?? '', 'xmlns:video') === VIDEO_SITEMAP_NAMESPACE,
    `${label}: missing the Google video sitemap namespace`)
  for (const { path, lastmod, images = [], video } of entries) {
    const url = canonicalFor(origin, path)
    const row = rows.get(url)
    if (lastmod === undefined) {
      assert(row?.lastmodCount === 0, `${label}: ${url} should omit lastmod`)
    } else {
      assert(isCalendarDate(lastmod), `${label}: invalid configured lastmod for ${url}`)
      assert(row?.lastmodCount === 1 && row.lastmod === lastmod, `${label}: ${url} must have one lastmod of ${lastmod}`)
    }
    const listed = row?.images ?? []
    const expected = images.map((image) => new URL(image, origin).href)
    assert(listed.length === expected.length && new Set(listed).size === listed.length &&
      expected.every((image) => listed.includes(image)), `${label}: ${url} must list exactly its configured photos`)
    assert(row?.videos.length === (video ? 1 : 0), `${label}: ${url} must list only its configured video`)
    if (video) {
      for (const [field, value] of Object.entries({
        thumbnail_loc: videoThumbnailUrl, title: video.name, description: video.description,
        content_loc: videoUrl, duration: String(video.durationSeconds), publication_date: video.uploadDate,
      })) {
        const fields = [...(row?.videos[0] ?? '').matchAll(new RegExp(`<video:${field}>(.*?)</video:${field}>`, 'g'))]
        assert(fields.length === 1 && decodeHtml(fields[0]?.[1]) === value, `${label}: incorrect video ${field} for ${url}`)
      }
    }
  }
  const count = [...rows.values()].reduce((sum, row) => sum + row.images.length, 0)
  assert(tags(xml, 'image:image').length === count && tags(xml, 'image:loc').length === count,
    `${label}: malformed or misplaced image entry`)
  assert(tags(xml, 'video:video').length === entries.filter(({ video }) => video).length,
    `${label}: malformed or misplaced video entry`)
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
  if (new URL(canonical).origin === HUB_ORIGIN) {
    const excludedLocation = decodeHtml(html).match(/\b(?:Davidsonville|Crofton|Queen\s+Anne\s+Estates|Fairwood|Woodmore|Mitchellville|Edgewater|Annapolis)\b/i)?.[0]
    assert(!excludedLocation, `${label}: remove the excluded location ${excludedLocation} from public content or metadata`)
  }
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
  const twitterImages = metaValues(html, 'name', 'twitter:image')
  const twitterImageAlts = metaValues(html, 'name', 'twitter:image:alt')
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
  if (shouldIndex && canonical === watchUrl) {
    const videos = tags(html, 'video')
    const player = videos[0] ?? ''
    assert(videos.length === 1 && rawVideoSources.length === 1 && rawVideoSources[0] === PUBLIC_TRAINING_VIDEO.assetPath &&
      attribute(player, 'poster') === PUBLIC_TRAINING_VIDEO.thumbnail && attribute(player, 'preload') === 'none' &&
      /\scontrols(?:[\s=>])/.test(player) && !/\sautoplay(?:[\s=>])/.test(player),
      `${label}: the static page must show one user-controlled player with the configured video and poster`)
    assert(h1s[0] === PUBLIC_TRAINING_VIDEO.name && /Silent footage/.test(html) && /What you’ll see/.test(html),
      `${label}: missing the film heading, silent label, or scene descriptions`)
    const descriptionTracks = tags(html, 'track').filter(tag => attribute(tag, 'kind') === 'descriptions')
    assert(descriptionTracks.length === 1 && attribute(descriptionTracks[0], 'srclang') === 'en' &&
      attribute(descriptionTracks[0], 'src') === videoDescriptionsPath && /\sid=["']change-of-direction["']/.test(html),
      `${label}: missing the English description track or linkable change-of-direction scene`)
    const next = html.match(/<nav\b[^>]*\baria-labelledby=["']training-film-next["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] ?? ''
    const links = anchorUrls(next)
    for (const href of [`${HUB_ORIGIN}/gymnastics`, `${HUB_ORIGIN}/fit-and-flip`, `${HUB_ORIGIN}/adult-gymnastics`, galleryUrl]) {
      assert(links.some(url => url.href === href), `${label}: missing the crawlable link to ${href}`)
    }
    for (const [id, paths] of [
      ['gymnastics-skills', ['/gymnastics#class-placement']],
      ['strength-and-handstand', [`${YOUTH_ATHLETIC_GUIDE_PATH}#strength-training-readiness`, '/adult-gymnastics#adult-handstand-preparation']],
      ['change-of-direction', [`${YOUTH_ATHLETIC_GUIDE_PATH}#speed-vs-agility`]],
    ]) {
      const scene = html.match(new RegExp(`<li\\b[^>]*\\sid=["']${id}["'][^>]*>[\\s\\S]*?<\\/li>`, 'i'))?.[0] ?? ''
      const sceneLinks = anchorUrls(scene)
      assert(paths.every(path => sceneLinks.some(url => url.href === `${HUB_ORIGIN}${path}`)),
        `${label}: the ${id} scene must link to coaching or class guidance`)
    }
    assert(anchorUrls(html).some(url => url.href === 'https://www.youtube.com/watch?v=bvGYBIgc_H8'),
      `${label}: missing the separate link to Vortex’s YouTube introduction`)
  } else {
    assert(rawVideoSources.length === 0, `${label}: raw HTML would load a video before the app can defer playback`)
  }
  if (shouldIndex && new URL(canonical).origin === HUB_ORIGIN) {
    assert(JSON.stringify(linkValues(html, 'icon')) === '["/favicon.png"]', `${label}: expected the stable square favicon`)
  }

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
  if (!shouldIndex && canonical === `${HUB_ORIGIN}/ninja`) {
    const holdContent = html.match(/<main\b[^>]*\sid=["']ninja-on-hold["'][^>]*>[\s\S]*?<\/main>/i)?.[0] ?? ''
    const holdLinks = anchorUrls(holdContent)
    assert(h1s.length === 1 && h1s[0] === 'Vortex Ninja is temporarily on hold' &&
      holdLinks.some(url => url.href === `${HUB_ORIGIN}/fit-and-flip#fit-flip-schedule`) &&
      holdLinks.some(url => url.href === `${HUB_ORIGIN}${BOWIE_YOUTH_SPORTS_GUIDE_PATH}#parkour-and-ninja`) &&
      !holdLinks.some(url => url.pathname === '/enroll' || url.pathname === '/read-board'),
      `${label}: the held Ninja page must show its status and link to available alternatives`)
  }
  if (shouldIndex && pageUrl.origin === HUB_ORIGIN) {
    const viewport = tags(html, 'meta').find(tag => attribute(tag, 'name') === 'viewport')
    const preloads = tags(html, 'link').filter(tag => attribute(tag, 'rel') === 'preload')
    const firstStylesheet = tags(html, 'link').find(tag => attribute(tag, 'rel') === 'stylesheet')
    if (['/', ...HUB_PROGRAM_PATHS, ...HUB_ARTICLE_PATHS].includes(pagePath)) {
      const heroes = tags(html, 'img').filter(tag => attribute(tag, 'fetchpriority') === 'high')
      const hints = preloads.filter(tag => attribute(tag, 'as') === 'image')
      const hero = heroes[0] ?? ''
      const hint = hints[0] ?? ''
      const picture = (html.match(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi) ?? []).find(block => block.includes(hero)) ?? ''
      const preferredSource = tags(picture, 'source').find(tag =>
        attribute(tag, 'type') === 'image/avif' && attribute(tag, 'srcset') && !attribute(tag, 'media'))
      const candidate = preferredSource ?? hero
      const sourceSet = attribute(candidate, 'srcset')
      const avifHeroPrefix = {
        '/gymnastics': 'gymnastics-hero',
        [GYMNASTICS_VS_TUMBLING_GUIDE_PATH]: 'tramp-tumble-hero',
      }[pagePath]
      if (avifHeroPrefix) {
        assert(preferredSource && attribute(hero, 'src').endsWith('.webp') &&
          [768, 1080, 1600].every(width => sourceSet.includes(`/${avifHeroPrefix}-${width}.avif ${width}w`)),
          `${label}: the hero must offer responsive AVIF with a WebP fallback`)
      }
      assert(heroes.length === 1 && hints.length === 1 && attribute(hint, 'fetchpriority') === 'high' &&
        viewport && html.indexOf(viewport) < html.indexOf(hint) && firstStylesheet && html.indexOf(hint) < html.indexOf(firstStylesheet),
        `${label}: the first image hint must follow the viewport and precede render-blocking styles`)
      const matchingSource = sourceSet
        ? !attribute(hint, 'href') && attribute(hint, 'imagesrcset') === sourceSet && attribute(hint, 'imagesizes') === attribute(candidate, 'sizes')
        : attribute(hint, 'href') === attribute(hero, 'src') && !attribute(hint, 'imagesrcset')
      assert(matchingSource && attribute(hint, 'type') === (preferredSource ? 'image/avif' : ''),
        `${label}: the hero image hint must match the displayed image without requesting a second candidate`)
      if (fitAndFlipPreviewPaths.includes(pagePath)) {
        const heroAlt = attribute(hero, 'alt')
        assert(ogImages[0] === fitAndFlipPreviewUrl && ogImageAlts[0] === heroAlt &&
          twitterImages.length === 1 && twitterImages[0] === fitAndFlipPreviewUrl &&
          twitterImageAlts.length === 1 && twitterImageAlts[0] === heroAlt,
          `${label}: the social previews must use the original Fit & Flip photo with the hero alt text`)
        assert(attribute(hero, 'src') === fitAndFlip && attribute(hero, 'srcset') === fitAndFlipSrcSet &&
          attribute(hero, 'width') === '900' && attribute(hero, 'height') === '675',
          `${label}: the displayed and preloaded hero must keep the responsive Fit & Flip crop`)
      }
    }
    if (['/', ...HUB_PROGRAM_PATHS, HUB_GUIDE_INDEX_PATH, ...HUB_ARTICLE_PATHS, PUBLIC_TRAINING_VIDEO.path].includes(pagePath)) {
      assert(!preloads.some(tag => attribute(tag, 'href') === '/fonts/oswald-latin-variable.woff2'),
        `${label}: preload only the font used in the initial view`)
    }
    const images = HUB_SITEMAP_ENTRIES.find(({ path }) => path === pagePath)?.images ?? []
    const imagesWithAlt = tags(html, 'img').filter((tag) => attribute(tag, 'alt'))
    const rendered = imagesWithAlt.map((tag) => attribute(tag, 'src'))
    for (const image of images) {
      const rotates = pagePath === '/' && HOME_ROTATING_SITEMAP_PHOTOS.includes(image)
      assert(rotates || rendered.includes(image), `${label}: sitemap photo must appear on the page with alt text (${image})`)
    }
    if (pagePath === '/') {
      assert(ogImages[0] === homePreviewUrl && ogImageAlts[0] === HOME_PREFERRED_PHOTO.alt &&
        twitterImages.length === 1 && twitterImages[0] === homePreviewUrl &&
        twitterImageAlts.length === 1 && twitterImageAlts[0] === HOME_PREFERRED_PHOTO.alt,
        `${label}: the homepage’s social previews must use its preferred training photo and alt text`)
      assert(images.includes(HOME_PREFERRED_PHOTO.src) && imagesWithAlt.some((tag) =>
        attribute(tag, 'src') === HOME_PREFERRED_PHOTO.src && attribute(tag, 'alt') === HOME_PREFERRED_PHOTO.alt),
        `${label}: the preferred training photo must appear in the sitemap and on the homepage with matching alt text`)
    }
  }
  const snapshotRoot = tags(html, 'div').find((tag) => attribute(tag, 'id') === 'root') ?? ''
  const expectedProgramSnapshot = shouldIndex && HUB_PROGRAM_PATHS.includes(pagePath) ? pagePath : ''
  assert(attribute(snapshotRoot, 'data-prerendered-program') === expectedProgramSnapshot,
    `${label}: the prerendered program marker must match the program route`)
  const expectedPublicSnapshot = shouldIndex && pageUrl.origin === HUB_ORIGIN &&
    !HUB_PROGRAM_PATHS.includes(pagePath) ? pagePath : ''
  assert(attribute(snapshotRoot, 'data-prerendered-page') === expectedPublicSnapshot,
    `${label}: the prerendered page marker must match the indexable route`)
  if (pageUrl.origin === HUB_ORIGIN) {
    for (const url of anchorUrls(html)) {
      if (!unifiedHosts.has(url.hostname.replace(/^www\./, ''))) continue
      if (shouldIndex) {
        assert(url.origin === HUB_ORIGIN,
          `${label}: crawlable link for ${url.pathname} must use the primary host`)
        assert(!url.searchParams.has(consentQueryParam) && !new URLSearchParams(url.hash.slice(1)).has(consentQueryParam),
          `${label}: crawlable link for ${url.pathname} includes a consent identifier`)
      }
      assert(!Object.hasOwn(legacyLandingRedirects, url.pathname.replace(/\/+$/, '').toLowerCase()),
        `${label}: link points to retired landing URL ${url.pathname}; use its destination directly`)
    }
  }
  const pageIds = new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]))
  const usesLegacyHeader = HUB_LEGACY_CHROME_PATHS.includes(pagePath)
  if (shouldIndex && (usesLegacyHeader || [
    '/', ...HUB_PROGRAM_PATHS, HUB_GUIDE_INDEX_PATH, ...HUB_ARTICLE_PATHS, '/read-board', '/enroll', '/drop-in', '/contact', '/jobs',
  ].includes(pagePath))) {
    const navigation = html.match(/<nav\b[^>]*\baria-label=["']Main navigation["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] ?? ''
    const links = anchorUrls(navigation)
    const expectedPaths = [...HUB_PROGRAM_PATHS, HUB_GUIDE_INDEX_PATH, '/jobs']
    if (!usesLegacyHeader) expectedPaths.push('/#programs', '/contact')
    for (const path of expectedPaths) {
      assert(links.filter((url) => url.href === canonicalFor(HUB_ORIGIN, path)).length === 1,
        `${label}: expected one crawlable main navigation link to ${path}`)
    }
    if (usesLegacyHeader) {
      const footer = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i)?.[0] ?? ''
      const footerLinks = anchorUrls(footer)
      assert(!/\bstyle=["'][^"']*\bopacity\s*:\s*0(?:\s*[;"'])/i.test(footer),
        `${label}: the static footer must be visible before JavaScript runs`)
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
  if (shouldIndex && pagePath === HUB_GUIDE_INDEX_PATH) {
    const shelf = html.match(/<ul\b[^>]*\baria-label=["']Training guides["'][^>]*>[\s\S]*?<\/ul>/i)?.[0] ?? ''
    const links = anchorUrls(shelf).map((url) => url.href)
    assert(links.length === HUB_ARTICLE_PATHS.length && HUB_ARTICLE_PATHS.every((path, index) => links[index] === canonicalFor(HUB_ORIGIN, path)),
      `${label}: the guide index must link to each published article in order`)
    const topicNav = html.match(/<nav\b[^>]*\baria-label=["']Browse guides by topic["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] ?? ''
    const topicLinks = anchorUrls(topicNav)
    assert(topicLinks.length === HUB_ARTICLE_PATHS.length &&
      HUB_ARTICLE_PATHS.every((path, index) => topicLinks[index].href === canonicalFor(HUB_ORIGIN, path)),
      `${label}: navigation by topic must link directly to every published guide`)
  }
  if (shouldIndex && HUB_ARTICLE_PATHS.includes(pagePath)) {
    const breadcrumb = html.match(/<nav\b[^>]*\baria-label=["']Breadcrumb["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] ?? ''
    assert(anchorUrls(breadcrumb).some((url) => url.href === canonicalFor(HUB_ORIGIN, HUB_GUIDE_INDEX_PATH)),
      `${label}: the article breadcrumb must link to the guide index`)
  }
  if (pagePath === '/' && shouldIndex) {
    assert(h1s[0] === 'Gymnastics & youth athletic training in Bowie, MD',
      `${label}: the homepage heading must identify the programs and Bowie location`)
    const heroDescription = html.match(/<p\b[^>]*\bclass=["']np-hero-description["'][^>]*>[\s\S]*?<\/p>/i)?.[0] ?? ''
    const heroLinks = anchorUrls(heroDescription)
    for (const path of ['/gymnastics', `${GYMNASTICS_VS_TUMBLING_GUIDE_PATH}#choose-a-class`, '/adult-gymnastics']) {
      assert(heroLinks.some(url => url.href === canonicalFor(HUB_ORIGIN, path)),
        `${label}: the homepage introduction must link directly to ${path}`)
    }
    const freeTrial = html.match(/<section\b[^>]*\sid=["']free-trial["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const trialLinks = tags(html, 'a').filter(tag => attribute(tag, 'data-analytics-cta') === 'free_trial')
    for (const [anchor, source] of [['open-free-trial-from-navigation', 'navigation'], ['open-free-trial', 'free_trial']]) {
      assert(trialLinks.some(tag => attribute(tag, 'href') === `#${anchor}` &&
        attribute(tag, 'aria-haspopup') === 'dialog' && attribute(tag, 'data-analytics-section') === source) &&
        new RegExp(`\\sid=["']${anchor}["']`).test(freeTrial),
        `${label}: the homepage trial link from ${source} must work before JavaScript starts`)
    }
    assert(/THE TRIAD OF ATHLETICISM/.test(html), `${label}: the primary homepage is missing the athleticism triad`)
    const startingClasses = html.match(/<section\b[^>]*\sid=["']starting-classes["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    assert(tags(html, 'a').some(tag => attribute(tag, 'data-analytics-cta') === 'explore_programs' &&
      attribute(tag, 'href') === '#starting-classes'),
      `${label}: the homepage Explore programs link must reach the age-based class choices`)
    const classList = startingClasses.match(/<ul\b[^>]*\bclass=["']np-class-paths-list["'][^>]*>[\s\S]*?<\/ul>/i)?.[0] ?? ''
    const classLinks = anchorUrls(classList)
    const ageNav = startingClasses.match(/<nav\b[^>]*\baria-label=["']Choose a program by age["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] ?? ''
    const ageLinks = anchorUrls(ageNav)
    for (const path of ['/gymnastics#preschool', '/gymnastics#choose-a-class', '/fit-and-flip#fit-flip-schedule', '/adult-gymnastics']) {
      assert(classLinks.some((url) => url.href === canonicalFor(HUB_ORIGIN, path)) &&
        ageLinks.some((url) => url.href === canonicalFor(HUB_ORIGIN, path)),
        `${label}: the starting class details and age navigation must link directly to ${path}`)
    }
    for (const ages of ['2–5', '6–17', '8–15', '18 and up']) {
      assert(startingClasses.includes(`Ages ${ages}`), `${label}: the guide to starting classes is missing ages ${ages}`)
    }
    for (const path of [PRESCHOOL_GYMNASTICS_GUIDE_PATH, GYMNASTICS_VS_TUMBLING_GUIDE_PATH,
      BOWIE_YOUTH_SPORTS_GUIDE_PATH, RETURNING_TO_GYMNASTICS_GUIDE_PATH]) {
      assert(classLinks.some((url) => url.href === canonicalFor(HUB_ORIGIN, path)),
        `${label}: starting classes must link directly to the matching guide at ${path}`)
    }
    const visit = html.match(/<section\b[^>]*\sid=["']visit["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const visitLinks = anchorUrls(visit)
    assert(/<address\b[^>]*>4961 Tesla Dr Suite E/i.test(visit) && visit.includes('Mon-Fri: 4:00-8:30 PM') &&
      visit.includes('Sat: 9:00 AM-12:00 PM') && visit.includes('Sunday: Closed'),
      `${label}: the homepage visit section must show the published address and hours`)
    assert(visitLinks.some((url) => url.href === canonicalFor(HUB_ORIGIN, '/read-board#schedule')),
      `${label}: the homepage visit section must link to the class schedule`)
    assert(visitLinks.some(isBowieDirections),
      `${label}: the homepage visit section must link to directions for the verified gym`)
    assert(visitLinks.some((url) => url.href === galleryUrl),
      `${label}: the homepage visit section must link to the Bowie gym photos`)
    const pageLinks = anchorUrls(html)
    for (const path of ['/enroll', '/drop-in', '/store', '/contact']) {
      assert(pageLinks.some((url) => url.href === canonicalFor(HUB_ORIGIN, path)),
        `${label}: missing a crawlable link to ${path}`)
    }
    for (const id of ['gymnastics', 'fit-flip']) {
      assert(pageIds.has(id), `${label}: missing homepage section #${id}`)
    }
  }

  if (shouldIndex && ['/read-board', '/enroll', '/drop-in'].includes(pagePath)) {
    assert(anchorUrls(html).some(url => url.href === accessibilityUrl),
      label + ': the public booking page must link to parking and accessibility')
  }

  if (shouldIndex && ['/contact', '/drop-in'].includes(pagePath)) {
    const introduction = [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/gi)]
      .find(([section]) => /<h1\b/i.test(section))?.[0] ?? ''
    const links = anchorUrls(introduction)
    const programTargets = pagePath === '/drop-in'
      ? ['/gymnastics#youth-gymnastics-schedule', '/fit-and-flip#fit-flip-schedule', '/adult-gymnastics#adult-class-schedule']
      : HUB_PROGRAM_PATHS
    for (const path of programTargets) {
      assert(links.some((url) => url.href === canonicalFor(HUB_ORIGIN, path)),
        `${label}: missing a crawlable program link to ${path} near the main heading`)
    }
    if (pagePath === '/contact') {
      assert(pageIds.has('inquiry') && /For a gymnastics team evaluation/.test(html),
        `${label}: the contact inquiry destination must explain what to share for team evaluation`)
      assert(links.some(isBowieDirections) && links.some((url) => url.href === galleryUrl),
        `${label}: the contact introduction must link to Maps and the facility photos`)
      const accessibility = html.match(/<section\b[^>]*\sid=["']parking-and-accessibility["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      const accessLinks = anchorUrls(accessibility)
      assert(/wheelchair-accessible parking/.test(accessibility) && /wheelchair-accessible entrance/.test(accessibility) &&
        accessLinks.some(url => url.href === 'https://www.google.com/maps?cid=15262285316302188709') &&
        accessLinks.some(url => url.href === 'tel:+14434224794') && /Melford Town Center/.test(html),
        `${label}: missing the facility arrival details, verified Maps listing, or contact number`)
      assert(/Melford Town Center/.test(accessibility) && /Bowie PGC Link/.test(accessibility) &&
        accessLinks.some(url => url.hostname === 'www.princegeorgescountymd.gov' && url.pathname.endsWith('/microtransit-pgc-link')),
        label + ': the arrival section must link to the county transit details for Melford')
      const gallery = html.match(/<section\b[^>]*\sid=["']inside-the-gym["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      const galleryPhotos = tags(gallery, 'img')
      assert(/<h2\b[^>]*>Inside the Bowie gym<\/h2>/i.test(gallery) && galleryPhotos.length === 5 &&
        galleryPhotos.every((tag) => attribute(tag, 'alt') && attribute(tag, 'loading') === 'lazy' &&
          attribute(tag, 'sizes').startsWith('auto, ') && /\b640w\b/.test(attribute(tag, 'srcset'))),
        `${label}: the facility gallery must render five labelled, responsive, lazy-loaded photos`)
      const galleryLinks = anchorUrls(gallery)
      assert(['/read-board#schedule', '/drop-in'].every(path => galleryLinks.some(url => url.href === HUB_ORIGIN + path)),
        label + ': the facility gallery must link to the class schedule and drop-in dates')
      assert(pageIds.has('gymnastics-equipment') && tags(gallery, 'figcaption').length === 2 &&
        galleryLinks.some(url => url.href === `${HUB_ORIGIN}/contact#inquiry`),
        `${label}: missing the equipment captions or where to ask about class equipment`)
      for (const path of ['/gymnastics#choose-a-class', '/fit-and-flip#body-control', '/fit-and-flip#strength', '/adult-gymnastics#class-format']) {
        assert(galleryLinks.some((url) => url.href === `${HUB_ORIGIN}${path}`),
          `${label}: missing facility gallery link to ${path}`)
      }
    } else {
      for (const program of ['Developmental Gymnastics', 'Fit & Flip', 'Adult Fitness & Acrobatics']) {
        assert(hasDropInProgramLink(links, program), `${label}: missing a link to ${program} drop-in dates near the main heading`)
      }
      assert(h1s[0] === 'Drop-in gymnastics & fitness in Bowie' && /Accepts free trials/.test(introduction) &&
        /unused one-time trial/.test(introduction),
        `${label}: missing the drop-in heading or the visible eligibility guidance`)
      assert(links.some((url) => url.href === `${HUB_ORIGIN}/adult-gymnastics#class-format`),
        `${label}: missing the crawlable link to what adults can expect in their first class`)
      assert(/Ask Vortex about make-up options/.test(introduction) &&
        links.some(url => url.href === `${HUB_ORIGIN}/contact#inquiry`) &&
        /How do I ask about a make-up class\?/.test(html) &&
        /Make-up options depend on your program and class availability/.test(html),
        `${label}: the drop-in page must explain how to ask about a missed class before booking`)
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
    const brandImage = (landmark) => {
      const sections = [...html.matchAll(new RegExp(`<${landmark}\\b[^>]*>[\\s\\S]*?<\\/${landmark}>`, 'gi'))]
      const section = sections.find(([markup]) =>
        attribute(tags(markup, landmark)[0] ?? '', 'class').split(/\s+/).includes(`np-${landmark}`))?.[0] ?? ''
      return tags(section, 'img').find((tag) => attribute(tag, 'alt') === 'Vortex Athletics & Gymnastics') ?? ''
    }
    const headerBrand = brandImage('header')
    const footerBrand = brandImage('footer')
    const footerSources = attribute(footerBrand, 'srcset')
    const headerSources = attribute(headerBrand, 'srcset')
    assert(['256w', '384w', '480w'].every(size => headerSources.includes(` ${size}`)) && attribute(headerBrand, 'sizes'),
      `${label}: the header logo must offer a compact responsive asset`)
    assert(attribute(footerBrand, 'loading') === 'lazy' && /\b640w\b/.test(footerSources) && !/\b1086w\b/.test(footerSources),
      `${label}: the compact footer logo must load lazily`)
    const mainHtml = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] ?? ''
    const mainLinks = anchorUrls(mainHtml)
    if (['/', '/gymnastics', '/fit-and-flip'].includes(pagePath)) {
      assert(mainLinks.some(url => url.href === watchUrl), `${label}: missing a crawlable link to the Vortex training film`)
    }
    if (pagePath === '/gymnastics' || pagePath === '/fit-and-flip') {
      const hero = mainHtml.match(/<section\b[^>]*\bclass=["']np-program-hero["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      const trialLink = tags(hero, 'a').find(tag => attribute(tag, 'data-analytics-cta') === 'free_trial') ?? ''
      const fallbackId = pagePath === '/gymnastics' ? 'first-visit' : 'training-fit'
      const fallback = mainHtml.match(new RegExp(`<section\\b[^>]*\\sid=["']${fallbackId}["'][^>]*>[\\s\\S]*?<\\/section>`, 'i'))?.[0] ?? ''
      assert(attribute(trialLink, 'href') === '#open-free-trial' &&
        attribute(trialLink, 'aria-haspopup') === 'dialog' &&
        tags(fallback, 'h2').some(tag => attribute(tag, 'id') === 'open-free-trial'),
        `${label}: the hero trial link must reach its visible first-class guidance before JavaScript starts`)
    }
    if (HUB_PROGRAM_PATHS.includes(pagePath)) {
      const visit = mainHtml.match(/<section\b[^>]*\baria-labelledby=["']program-visit-heading["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      const visitLinks = anchorUrls(visit)
      assert([galleryUrl, accessibilityUrl].every(destination => visitLinks.some(url => url.href === destination)),
        `${label}: the program visit section must link to the Bowie gym photos and accessibility details`)
      const pricing = mainHtml.match(/<details\b[^>]*\bclass=["']np-class-pricing\b[^>]*>[\s\S]*?<\/details>/i)?.[0] ?? ''
      const pricingLinks = anchorUrls(pricing)
      assert(/Request cancellation/.test(pricing) &&
        pricingLinks.some(url => url.href === `${HUB_ORIGIN}/terms-of-service`) &&
        pricingLinks.some(url => url.href === `${HUB_ORIGIN}/contact#inquiry`),
        `${label}: missing the published recurring enrollment cancellation path or terms and contact links`)
    }
    if (pagePath === '/gymnastics') {
      const schoolAge = mainHtml.match(/<article\b[^>]*\sid=["']youth["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
      const schoolAgeDescription = schoolAge.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? ''
      const schoolAgeLinks = anchorUrls(schoolAge)
      assert(/<h3\b[^>]*>Gymnastics classes for ages 6–12<\/h3>/i.test(schoolAge) &&
        /\bTornadoes\b/.test(schoolAgeDescription) && /\bTrial Assessment\b/.test(schoolAgeDescription) &&
        ['#youth-gymnastics-schedule', '#experienced-trial', '#competitive-gymnastics-team'].every(hash =>
          schoolAgeLinks.some(url => url.href === canonical + hash)),
        `${label}: the legacy school-age landing must explain starting options and link to class times, assessment, and team placement`)
      const schedule = mainHtml.match(/<section\b[^>]*\sid=["']youth-gymnastics-schedule["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      assert(/<h2\b[^>]*>Weekly youth gymnastics class schedule<\/h2>/i.test(schedule) && /Mommy &amp; Me.*preschool/.test(schedule),
        `${label}: missing the crawlable youth gymnastics schedule and age-group guidance`)
      if (pageIds.has('youth-booking-summary')) verifyYouthBookingSummary(label, schedule, programActions.get(pagePath))
      const prices = schedule.match(/<details\b[^>]*\sid=["']youth-gymnastics-pricing["'][^>]*>[\s\S]*?<\/details>/i)?.[0] ?? ''
      const priceLinks = anchorUrls(prices)
      assert(priceLinks.some((url) => url.origin === HUB_ORIGIN && url.pathname === '/enroll' &&
        url.searchParams.get('program') === 'Developmental Gymnastics'),
        `${label}: the youth gymnastics price comparison must link to developmental enrollment`)
      assert(/Dirt Devils.*Twisters.*Tornadoes.*Cyclones.*Vortex A4 Elite/.test(schedule) &&
        /Compare youth gymnastics prices/.test(prices) && /Paid monthly enrollment requires an active annual membership/.test(prices) &&
        /How much do youth gymnastics classes cost\?/.test(mainHtml) && hasDropInProgramLink(priceLinks, 'Developmental Gymnastics') &&
        priceLinks.some(url => url.href === `${canonical}#first-visit`),
        `${label}: missing the crawlable youth class comparison, tuition guidance, or trial and drop-in links`)
      const firstVisit = mainHtml.match(/<section\b[^>]*\sid=["']first-visit["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      assert(/<h2\b[^>]*>What to expect at your child’s first gymnastics class<\/h2>/i.test(firstVisit),
        `${label}: missing the first gymnastics visit section`)
      assert(/<h3\b[^>]*>What should my child wear to class\?<\/h3>/i.test(firstVisit) &&
        /parent or legal guardian/i.test(firstVisit), `${label}: missing first-visit attire or guardian guidance`)
      assert(/60 minutes/i.test(firstVisit) && /90 minutes/i.test(firstVisit),
        `${label}: missing the typical length of the youth gymnastics trials`)
      assert(hasProgramTrialLink(firstVisit, 'first-visit'),
        `${label}: the first visit trial finder must work as a native link before startup`)
      const accessLinks = anchorUrls(firstVisit)
      assert(accessLinks.some(url => url.href === `${HUB_ORIGIN}/contact#inquiry`) &&
        accessLinks.some(url => url.href === `${HUB_ORIGIN}${GYMNASTICS_VS_TUMBLING_GUIDE_PATH}#accessible-gymnastics`),
        `${label}: first-time families must have crawlable links to ask about class access and compare adaptive options`)
    }
    if (pagePath === '/fit-and-flip') {
      const bodyControl = mainHtml.match(/<article\b[^>]*\sid=["']body-control["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
      assert(anchorUrls(bodyControl).some(url => url.href === `${canonical}#fit-flip-schedule`),
        `${label}: the body control and tumbling topic must link to the current Fit & Flip schedule`)
      assert(mainLinks.some(url => url.href === `${HUB_ORIGIN}${BOWIE_YOUTH_SPORTS_GUIDE_PATH}#compare-athletic-training`),
        `${label}: Fit & Flip must link to the Bowie youth athletic training comparison`)
      assert(mainLinks.some(url => url.href === `${HUB_ORIGIN}${BOWIE_YOUTH_SPORTS_GUIDE_PATH}#youth-team-training`),
        `${label}: Fit & Flip must link coaches to local youth team training options`)
      const frameworkBooking = mainHtml.match(/<article\b[^>]*\sid=["']apply-athleticism-accelerator["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
      assert(/ages 8–11 or 12–15/i.test(frameworkBooking),
        `${label}: the Athleticism Accelerator booking article must explain both Cyclones age groups`)
      const frameworkLinks = anchorUrls(frameworkBooking)
      assert(['#fit-flip-schedule', '#training-fit'].every(hash => frameworkLinks.some(url => url.href === `${canonical}${hash}`)),
        `${label}: the Athleticism Accelerator booking article must link to recurring times and first-class options`)
      const speedAgility = mainHtml.match(/<article\b[^>]*\sid=["']speed-agility["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
      assert(/<h3\b[^>]*>Speed and agility for youth sports<\/h3>/i.test(speedAgility),
        `${label}: missing the crawlable speed and agility heading at #speed-agility`)
      const strength = mainHtml.match(/<article\b[^>]*\sid=["']strength["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
      assert(/<h3\b[^>]*>Youth strength training<\/h3>/i.test(strength),
        `${label}: missing the crawlable strength training heading at #strength`)
      const classExample = mainHtml.match(/<section\b[^>]*\sid=["']fit-flip-class-example["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      const exampleTopics = tags(classExample, 'article').map((tag) => attribute(tag, 'id'))
      assert(['landing-rehearsal', 'strength-practice', 'jump-practice'].every((topic) => exampleTopics.includes(topic)),
        `${label}: missing the three parts of the Fit & Flip landing example`)
      const schedule = mainHtml.match(/<section\b[^>]*\sid=["']fit-flip-schedule["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      assert(/<h2\b[^>]*>Recurring Fit &amp; Flip class times<\/h2>/i.test(schedule) && /8–11 and 12–15/.test(schedule),
        `${label}: missing the crawlable Fit & Flip schedule heading or age groups`)
      const scheduleIntro = schedule.match(/<p\b[^>]*>[\s\S]*?<\/p>/i)?.[0] ?? ''
      assert(/Choose a recurring weekday during enrollment/i.test(scheduleIntro),
        `${label}: the Fit & Flip schedule intro must explain choosing a recurring weekday`)
      if (pageIds.has('youth-booking-summary')) verifyYouthBookingSummary(label, schedule, programActions.get(pagePath))
      assert(anchorUrls(schedule).some((url) => url.origin === HUB_ORIGIN && url.pathname === '/enroll' && url.searchParams.get('program') === 'Fit & Flip'),
        `${label}: the Fit & Flip schedule must link to filtered enrollment`)
      const pricing = schedule.match(/<details\b[^>]*\sid=["']fit-flip-class-pricing["'][^>]*>[\s\S]*?<\/details>/i)?.[0] ?? ''
      const priceLinks = anchorUrls(pricing)
      assert(/Compare Fit &amp; Flip prices/i.test(pricing) && /Paid monthly enrollment requires an active annual membership/i.test(pricing) &&
        hasDropInProgramLink(priceLinks, 'Fit & Flip') &&
        priceLinks.some((url) => url.origin === HUB_ORIGIN && url.pathname === '/enroll' && url.searchParams.get('program') === 'Fit & Flip') &&
        priceLinks.some((url) => url.href === `${HUB_ORIGIN}/fit-and-flip#training-fit`),
        `${label}: missing the Fit & Flip price comparison and its crawlable booking and trial links`)
      assert(hasDropInProgramLink(mainLinks, 'Fit & Flip'), `${label}: missing a crawlable link for Cyclones drop-in dates`)
      const firstClass = mainHtml.match(/<section\b[^>]*\sid=["']training-fit["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      const firstClassLinks = anchorUrls(firstClass)
      assert(pageIds.has('compare-cyclones-classes') &&
        firstClassLinks.some(url => url.href === `${HUB_ORIGIN}/gymnastics#gymnastics-level-intermediate`),
        `${label}: the two Cyclones programs must be distinguishable from the Fit & Flip first-class section`)
      for (const hash of ['#fitness-without-a-team', '#high-school-sports-training']) {
        assert(firstClassLinks.some(url => url.href === `${HUB_ORIGIN}${BOWIE_YOUTH_SPORTS_GUIDE_PATH}${hash}`),
          `${label}: Fit & Flip age guidance must link to the local options at ${hash}`)
      }
      const ageOptions = firstClass.match(/<article\b[^>]*\sid=["']fit-flip-trial-age["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
      assert(/ages 6–7.*Tornadoes/.test(ageOptions) &&
        anchorUrls(ageOptions).some(url => url.href === `${HUB_ORIGIN}/gymnastics#first-visit`),
        `${label}: missing the beginner gymnastics trial path for ages 6–7`)
      assert(hasProgramTrialLink(firstClass, 'training-fit'),
        `${label}: the Fit & Flip trial finder must work as a native link before startup`)
      assert(anchorUrls(firstClass).some((url) => url.href === `${HUB_ORIGIN}/fit-and-flip#fit-flip-class-pricing`),
        `${label}: missing the price comparison link from the Fit & Flip first-class options`)
      assert(/Use your child’s age on the class date/.test(firstClass) && /12–15 group/.test(firstClass) &&
        /parent or legal guardian/.test(firstClass) && /no payment card is required/.test(firstClass),
        `${label}: missing the Fit & Flip trial age, registration, or payment guidance`)
    }
    if (pagePath === '/adult-gymnastics') {
      const hero = mainHtml.match(/<section\b[^>]*\bclass=["']np-program-hero["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      const schedule = mainHtml.match(/<section\b[^>]*\sid=["']adult-class-schedule["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      assert(hero && !hero.includes('adult-class-schedule') && /<h2\b[^>]*>Recurring adult gymnastics class times<\/h2>/i.test(schedule),
        `${label}: recurring adult class times must have a crawlable section outside the hero`)
      assert(anchorUrls(schedule).some((url) => url.origin === HUB_ORIGIN && url.pathname === '/enroll' &&
        url.searchParams.get('program') === 'Adult Fitness & Acrobatics'),
        `${label}: the recurring adult schedule must link to Typhoons enrollment`)
      const publishedBooking = schedule.match(/<div\b[^>]*\sid=["']adult-booking-summary["'][^>]*>[\s\S]*?<\/div>/i)?.[0]
      if (publishedBooking) {
        const weeklyRows = publishedBooking.match(/<li\b[^>]*\bclass=["']np-adult-recurring-time["'][^>]*>[\s\S]*?<\/li>/gi) ?? []
        assert(/Catalog checked <time\b[^>]*\bdatetime=["']\d{4}-\d{2}-\d{2}["']/i.test(publishedBooking) &&
          (weeklyRows.length > 0 || /\$[\d,.]+ (?:base tuition per month|per nonmember drop-in)/.test(publishedBooking)),
          `${label}: the published adult booking summary must show a dated catalog check and verified hours or price`)
        for (const row of weeklyRows) {
          const times = tags(row, 'time')
          assert(/Recurring class<\/strong>.*\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/.test(row) &&
            /Eastern/.test(row) && times.length === 2 &&
            times.every(tag => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(attribute(tag, 'datetime'))),
            `${label}: recurring adult hours must show the weekday, start and end times, and time zone`)
        }
        if (publishedBooking.includes('per nonmember drop-in')) {
          assert(tags(publishedBooking, 'time').length >= 2 && /Eastern/.test(publishedBooking) &&
            hasDropInProgramLink(anchorUrls(publishedBooking), 'Adult Fitness & Acrobatics'),
            `${label}: the adult drop-in summary must show a dated time and link to the live calendar`)
        }
        if (publishedBooking.includes('base tuition per month')) {
          assert(/Recurring enrollment requires an active annual membership/.test(publishedBooking),
            `${label}: the adult monthly tuition summary must explain the annual membership requirement`)
        }
      }
      const pricing = schedule.match(/<details\b[^>]*\sid=["']adult-class-pricing["'][^>]*>[\s\S]*?<\/details>/i)?.[0] ?? ''
      assert(/Compare adult gymnastics prices/i.test(pricing) && /Paid monthly enrollment requires an active annual membership/i.test(pricing) &&
        hasDropInProgramLink(anchorUrls(pricing), 'Adult Fitness & Acrobatics') &&
        anchorUrls(pricing).some(url => url.origin === HUB_ORIGIN && url.pathname === '/enroll' && url.searchParams.get('program') === 'Adult Fitness & Acrobatics'),
        `${label}: missing the adult price comparison and its crawlable booking links`)
      assert(hasDropInProgramLink(mainLinks, 'Adult Fitness & Acrobatics'), `${label}: missing a crawlable link for single-class adult bookings`)
      const format = mainHtml.match(/<section\b[^>]*\sid=["']class-format["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      assert(/Can I start adult gymnastics with no experience\?/i.test(format) && /with your feet on the floor/i.test(format) &&
        anchorUrls(format).some(url => url.href === `${watchUrl}#strength-and-handstand`),
        `${label}: missing the beginner answer or a concrete example of a starting exercise`)
      assert(anchorUrls(format).some((url) => url.href === `${HUB_ORIGIN}/adult-gymnastics#adult-availability`),
        `${label}: missing the first-visit link from the adult class format section`)
      const adultTumbling = format.match(/<article\b[^>]*\sid=["']adult-tumbling["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
      assert(anchorUrls(adultTumbling).some(url => url.href === `${HUB_ORIGIN}${RETURNING_TO_GYMNASTICS_GUIDE_PATH}#nearby-adult-gymnastics`),
        `${label}: missing adult tumbling guidance and the link to compare nearby options`)
      const firstVisit = mainHtml.match(/<section\b[^>]*\sid=["']adult-availability["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      assert(/<h2\b[^>]*>Plan your first adult gymnastics class<\/h2>/i.test(firstVisit) && /select yourself as the participant/i.test(firstVisit),
        `${label}: missing adult registration and first-visit guidance`)
      assert(hasDropInProgramLink(anchorUrls(firstVisit), 'Adult Fitness & Acrobatics'),
        `${label}: adult first-visit guidance must link to the Typhoons drop-in schedule`)
      const confirmation = firstVisit.match(/<article\b[^>]*\sid=["']adult-drop-in-confirmation["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
      assert(['Drop-in confirmed', 'Drop-in payment', 'Check payment status'].every(text => confirmation.includes(text)) &&
        anchorUrls(confirmation).some(url => url.href === `${HUB_ORIGIN}/contact#inquiry`),
        `${label}: missing the Typhoons confirmation and pending payment guidance or its inquiry link`)
      const weeklyTraining = firstVisit.match(/<article\b[^>]*\sid=["']adult-weekly-training["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
      assert(/one 90-minute Typhoons class a week/.test(weeklyTraining) &&
        anchorUrls(weeklyTraining).some(url => url.href === `${HUB_ORIGIN}/adult-gymnastics#adult-class-schedule`),
        `${label}: missing once-a-week adult training guidance and its current schedule link`)
      assert(mainLinks.some((url) => url.href === canonicalFor(HUB_ORIGIN, RETURNING_TO_GYMNASTICS_GUIDE_PATH)),
        `${label}: adult gymnastics must link to the guide for returning gymnasts`)
      assert(mainLinks.some(url => url.href === `${HUB_ORIGIN}${RETURNING_TO_GYMNASTICS_GUIDE_PATH}#nearby-adult-gymnastics`),
        `${label}: adult gymnastics must link to the local class and open-gym comparison`)
      const returning = format.match(/<article\b[^>]*\sid=["']returning-gymnasts["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
      assert(anchorUrls(returning).some(url => url.href === `${HUB_ORIGIN}${RETURNING_TO_GYMNASTICS_GUIDE_PATH}#adult-gymnastics-apparatus`),
        `${label}: returning gymnasts must be able to find the apparatus practice comparison`)
      assert(mainLinks.some(url => url.href === `${HUB_ORIGIN}${RETURNING_TO_GYMNASTICS_GUIDE_PATH}#adult-gymnastics-competition`),
        `${label}: the adult program must link to the competition guidance`)
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

  if (shouldIndex && pagePath === RETURNING_TO_GYMNASTICS_GUIDE_PATH) {
    const guideLinks = anchorUrls(html.match(/<article\b[^>]*>[\s\S]*?<\/article>/i)?.[0] ?? '')
    assert(guideLinks.some((url) => url.href === canonicalFor(HUB_ORIGIN, '/adult-gymnastics')),
      `${label}: the guide must link to the adult gymnastics program`)
    for (const hash of ['#class-format', '#adult-class-pricing', '#adult-weekly-training']) {
      assert(guideLinks.some((url) => url.href === `${canonicalFor(HUB_ORIGIN, '/adult-gymnastics')}${hash}`),
        `${label}: the returning gymnastics guide must link to ${hash} on the adult program page`)
    }
    const competition = html.match(/<section\b[^>]*\sid=["']adult-gymnastics-competition["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const competitionLinks = anchorUrls(competition)
    assert(tags(html, 'a').some(tag => attribute(tag, 'href') === '#adult-gymnastics-competition') &&
      competitionLinks.some(url => url.href === 'https://unitedclubgymnastics.org/join/') &&
      competitionLinks.some(url => url.href === 'https://unitedclubgymnastics.org/events/'),
      `${label}: missing the adult competition section, outline link, or official eligibility and calendar links`)
    const nearby = html.match(/<section\b[^>]*\sid=["']nearby-adult-gymnastics["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const nearbyLinks = anchorUrls(nearby)
    assert(/Typhoons is a 90-minute coached class/.test(nearby) && /College Park/.test(nearby) && /Millersville/.test(nearby) &&
      hasDropInProgramLink(nearbyLinks, 'Adult Fitness & Acrobatics') &&
      nearbyLinks.some(url => url.href === 'https://sph.umd.edu/student-opportunities/student-organizations-honor-societies-and-honor-programs/gymkana/gymkana-classes') &&
      nearbyLinks.some(url => url.href === 'https://www.docksidersgymnastics.com/adults'),
      `${label}: missing adult gymnastics options or links to their official class information`)
    assert(/Fairland/.test(nearby) && /Upper Marlboro/.test(nearby) &&
      nearbyLinks.some(url => url.href === 'https://www.pgparks.com/your-guide') &&
      nearbyLinks.some(url => url.href === 'https://www.mga-gymnastics.com/opengym.html'),
      `${label}: missing adult county classes or the Upper Marlboro open gym and their official links`)
    assert(nearbyLinks.some(url => url.href === 'https://www.eagcgym.com/recclasses'),
      `${label}: missing the coached floor and trampoline class in Laurel`)
    const apparatus = html.match(/<section\b[^>]*\sid=["']adult-gymnastics-apparatus["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const apparatusLinks = anchorUrls(apparatus)
    assert(tags(html, 'a').some(tag => attribute(tag, 'href') === '#adult-gymnastics-apparatus') &&
      apparatusLinks.some(url => url.href === 'https://www.dynamitegc.com/adult-gymnastics') &&
      apparatusLinks.some(url => url.href === 'https://www.mga-gymnastics.com/opengym.html') &&
      apparatusLinks.some(url => url.href === `${HUB_ORIGIN}/contact#gymnastics-equipment`) &&
      apparatusLinks.some(url => url.href === `${HUB_ORIGIN}/contact#inquiry`),
      `${label}: missing coached apparatus, open gym, or Vortex inquiry links in the adult apparatus comparison`)
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
    if (pageUrl.origin === HUB_ORIGIN) {
      const graphTypes = metaValues(html, 'property', 'og:type')
      const expectedType = HUB_ARTICLE_PATHS.includes(pagePath) ? 'article' : 'website'
      assert(graphTypes.length === 1 && graphTypes[0] === expectedType,
        `${label}: expected one Open Graph type of ${expectedType}`)
      const largePhotoPaths = [
        '/', '/gymnastics', '/adult-gymnastics', '/contact', ...fitAndFlipPreviewPaths, YOUTH_ATHLETIC_GUIDE_PATH,
        PRESCHOOL_GYMNASTICS_GUIDE_PATH, GYMNASTICS_VS_TUMBLING_GUIDE_PATH, RETURNING_TO_GYMNASTICS_GUIDE_PATH,
      ]
      if (largePhotoPaths.includes(pagePath)) {
        assert(robots.length === 1 && /(?:^|,)\s*max-image-preview:large(?:,|$)/i.test(robots[0]),
          `${label}: the representative full-size photo must allow large image previews`)
      }
    }
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
  const preschoolGuideCanonical = canonicalFor(HUB_ORIGIN, PRESCHOOL_GYMNASTICS_GUIDE_PATH)
  const tumblingGuideCanonical = canonicalFor(HUB_ORIGIN, GYMNASTICS_VS_TUMBLING_GUIDE_PATH)
  const fitAndFlipCanonical = canonicalFor(HUB_ORIGIN, '/fit-and-flip')
  if (shouldIndex && [HUB_ORIGIN, guideCanonical, fitAndFlipCanonical].includes(canonical)) {
    const content = (canonical === guideCanonical
      ? html.match(/<article\b[^>]*>[\s\S]*?<\/article>/i)
      : html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i))?.[0] ?? ''
    const links = anchorUrls(content)
    if (canonical !== guideCanonical) {
      assert(links.some((url) => url.href === guideCanonical),
        `${label}: missing the crawlable youth athletic development guide link in main content`)
      if (canonical === fitAndFlipCanonical) {
        for (const hash of ['#movement-progression', '#sports-season', '#strength-training-readiness', '#progress', '#speed-vs-agility', '#soccer-speed-and-agility', '#youth-performance-assessment', '#balance-during-a-growth-spurt', '#youth-plyometrics']) {
          assert(links.some((url) => url.href === `${guideCanonical}${hash}`),
            `${label}: missing the link to the parent guide at ${hash}`)
        }
        const conditioning = content.match(/<article\b[^>]*\sid=["']conditioning["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
        assert(anchorUrls(conditioning).some(url => url.href === `${guideCanonical}#sports-season`),
          `${label}: the conditioning section must link to the in-season training guidance`)
      }
    } else {
      const examples = content.match(/<section\b[^>]*\sid=["']movement-examples["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      const speedAgility = content.match(/<section\b[^>]*\sid=["']speed-vs-agility["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      const progression = content.match(/<section\b[^>]*\sid=["']movement-progression["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      const sportsSeason = content.match(/<section\b[^>]*\sid=["']sports-season["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      const plyometrics = content.match(/<section\b[^>]*\sid=["']youth-plyometrics["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      const readiness = content.match(/<section\b[^>]*\sid=["']strength-training-readiness["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      const progress = content.match(/<section\b[^>]*\sid=["']progress["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
      const outline = content.match(/<nav\b[^>]*\baria-label=["']In this guide["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] ?? ''
      assert(tags(examples, 'li').length === 8, `${label}: expected eight crawlable athleticism examples`)
      const speedAgilityLinks = anchorUrls(speedAgility)
      assert(tags(speedAgility, 'li').length === 3 && /Two-point start/i.test(speedAgility) && /mirror shuffle/i.test(speedAgility) &&
        speedAgilityLinks.some(url => url.href === `${watchUrl}#change-of-direction`) &&
        speedAgilityLinks.some(url => url.href === 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9465760/'),
        `${label}: missing the speed and agility coaching examples, video moment, or research link`)
      const soccer = speedAgility.match(/<div\b[^>]*\sid=["']soccer-speed-and-agility["'][^>]*>[\s\S]*?<\/div>/i)?.[0] ?? ''
      const soccerLinks = anchorUrls(soccer)
      assert(/Speed and agility for youth soccer/.test(soccer) && /8–11 and 12–15/.test(soccer) &&
        soccerLinks.some(url => url.href === `${fitAndFlipCanonical}#fit-flip-schedule`) &&
        soccerLinks.some(url => url.href === `${watchUrl}#change-of-direction`) &&
        soccerLinks.some(url => url.href === 'https://bowiesoccer.com/programs/') &&
        soccerLinks.some(url => url.href === 'https://pubmed.ncbi.nlm.nih.gov/40293724/'),
        `${label}: missing the crawlable youth soccer example, sources, or Cyclones schedule link`)
      assert(tags(progression, 'ol').length === 1 && tags(progression, 'li').length === 4,
        `${label}: expected the four coaching stages in an ordered list`)
      for (const hash of ['#movement-progression', '#strength-training-readiness', '#progress', '#youth-performance-assessment', '#balance-during-a-growth-spurt', '#youth-plyometrics']) {
        assert(tags(outline, 'a').some((tag) => attribute(tag, 'href') === hash),
          `${label}: missing the link to ${hash} in the guide outline`)
      }
      const plyometricsLinks = anchorUrls(plyometrics)
      assert(plyometricsLinks.some(url => url.href === `${fitAndFlipCanonical}#explosiveness`) &&
        plyometricsLinks.some(url => url.href === `${fitAndFlipCanonical}#training-fit`) &&
        plyometricsLinks.some(url => url.hostname === 'www.nsca.com' && url.pathname.endsWith('position_stand_youth_resistance_training---2009.pdf')),
        `${label}: the plyometrics guide must include its source and crawlable program links`)
      const growth = progression.match(/<div\b[^>]*\sid=["']balance-during-a-growth-spurt["'][^>]*>[\s\S]*?<\/div>/i)?.[0] ?? ''
      assert(/smaller hop/.test(growth) &&
        anchorUrls(growth).some(url => url.href === 'https://www.healthychildren.org/english/healthy-living/sports/pages/is-your-child-ready-for-sports.aspx'),
        `${label}: missing the growth-spurt balance example or American Academy of Pediatrics source`)
      assert(tags(sportsSeason, 'li').length === 2 &&
        anchorUrls(sportsSeason).some((url) => url.href === `${fitAndFlipCanonical}#fit-flip-class-example`),
        `${label}: missing the examples for training around the season or link to the public class example`)
      assert(/Can they listen to a coach/i.test(readiness) &&
        anchorUrls(readiness).some((url) => url.href === `${fitAndFlipCanonical}#training-fit`),
        `${label}: missing the youth strength training readiness guidance or link to the beginner program options`)
      assert(/Do kids need weights to get stronger\?/.test(readiness) &&
        anchorUrls(readiness).some(url => url.href === 'https://www.cdc.gov/physical-activity-basics/guidelines/children.html'),
        `${label}: missing the CDC-backed section on building strength through play`)
      assert(/hip hinge/.test(readiness) && /light kettlebell/.test(readiness) &&
        anchorUrls(readiness).some(url => url.href === `${watchUrl}#strength-and-handstand`),
        `${label}: missing the coached strength progression or training film example`)
      assert(/The first two steps of a sprint/i.test(progress) && /counts controlled starts/i.test(progress),
        `${label}: missing the Athleticism Accelerator coaching example for checking progress`)
      const assessment = progress.match(/<div\b[^>]*\sid=["']youth-performance-assessment["'][^>]*>[\s\S]*?<\/div>/i)?.[0] ?? ''
      const assessmentLinks = anchorUrls(assessment)
      assert(assessmentLinks.some(url => url.href === `${fitAndFlipCanonical}#training-fit`) &&
        assessmentLinks.some(url => url.href === 'https://www.goatlabperformance.com/programs/get-started') &&
        assessmentLinks.some(url => url.hostname === 'www.nsca.com' && url.pathname.endsWith('.pdf')),
        `${label}: missing the first-class and youth performance assessment comparison or its sources`)
      assert(links.some((url) => url.href === fitAndFlipCanonical),
        `${label}: missing a crawlable link from the guide to the Fit & Flip program page`)
      assert(links.some((url) => url.href === `${fitAndFlipCanonical}#strength`),
        `${label}: missing a crawlable link from the guide to youth strength training`)
      for (const hash of ['#fit-flip-schedule', '#training-fit']) {
        assert(links.some((url) => url.href === `${fitAndFlipCanonical}${hash}`),
          `${label}: missing the crawlable Fit & Flip guide link to ${hash}`)
      }
      assert(hasDropInProgramLink(links, 'Fit & Flip'), `${label}: missing the guide link to Cyclones drop-in dates`)
      assert(links.some(url => url.href === `${bowieGuideCanonical}#compare-athletic-training`),
        `${label}: missing the link to compare Bowie youth athletic training providers`)
    }
  }

  if (shouldIndex && pagePath === '/read-board') {
    const introduction = [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/gi)]
      .find(([section]) => /<h1\b/i.test(section))?.[0] ?? ''
    assert(anchorUrls(introduction).some((url) => url.href === bowieGuideCanonical),
      `${label}: missing the crawlable Bowie youth sports guide link near the main heading`)
    assert(anchorUrls(introduction).some(url => url.href === `${HUB_ORIGIN}/gymnastics#competitive-gymnastics-team`),
      `${label}: the class board must link to competitive gymnastics placement guidance`)
    const viewLinks = anchorUrls(introduction.match(/<nav\b[^>]*\baria-label=["']Browse classes and updates["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] ?? '')
    for (const hash of ['#classes', '#schedule', '#events', '#highlights']) {
      assert(viewLinks.some((url) => url.href === `${HUB_ORIGIN}/read-board${hash}`) && pageIds.has(hash.slice(1)),
        `${label}: missing a working static link for ${hash}`)
    }
    const classes = html.match(/<section\b[^>]*\baria-labelledby=["']read-board-classes-heading["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const classLinks = anchorUrls(classes)
    assert(/Fit &amp; Flip Cyclones classes for ages 8–11 and 12–15/.test(classes) &&
      /Dirt Devils and Twisters/.test(classes) && /Tornadoes, gymnastics Cyclones, and Vortex A4 Elite/.test(classes) &&
      /Typhoons adult gymnastics/.test(classes),
      `${label}: missing crawlable youth fitness age groups or adult gymnastics class information`)
    for (const path of ['/gymnastics#choose-a-class', '/gymnastics#preschool', '/gymnastics#class-placement',
      '/fit-and-flip#fit-flip-schedule', '/adult-gymnastics', '/adult-gymnastics#adult-availability']) {
      assert(classLinks.some(url => url.href === `${HUB_ORIGIN}${path}`), `${label}: missing class board program link to ${path}`)
    }
    const schedule = html.match(/<section\b[^>]*\sid=["']schedule["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    assert(/<h2\b[^>]*>Class schedule in Bowie, MD<\/h2>/i.test(schedule),
      `${label}: missing the static class schedule heading`)
    const bookingLinks = anchorUrls(schedule)
    for (const path of ['/#free-trial', '/enroll', '/gymnastics#youth-gymnastics-schedule', '/fit-and-flip#fit-flip-schedule', '/drop-in', '/adult-gymnastics#adult-class-schedule']) {
      assert(bookingLinks.some((url) => url.href === `${HUB_ORIGIN}${path}`),
        `${label}: missing a static schedule link to ${path}`)
    }
  }
  if (shouldIndex && canonical === bowieGuideCanonical) {
    const content = html.match(/<article\b[^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
    const links = anchorUrls(content)
    for (const path of [
      '/gymnastics', '/gymnastics#first-visit', '/gymnastics#youth-gymnastics-schedule', '/gymnastics#youth-gymnastics-pricing',
      '/fit-and-flip', '/fit-and-flip#fit-flip-class-pricing', '/read-board',
      YOUTH_ATHLETIC_GUIDE_PATH, PRESCHOOL_GYMNASTICS_GUIDE_PATH, `${GYMNASTICS_VS_TUMBLING_GUIDE_PATH}#nearby-tumbling-classes`,
    ]) {
      assert(links.some((url) => url.href === canonicalFor(HUB_ORIGIN, path)),
        `${label}: missing the crawlable guide link to ${path}`)
    }
    assert(hasDropInProgramLink(links, 'Fit & Flip'), `${label}: missing the guide link to Cyclones drop-in dates`)
    const nearbyGymnastics = content.match(/<section\b[^>]*\sid=["']youth-gymnastics-classes["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const nearbyGymnasticsLinks = anchorUrls(nearbyGymnastics)
    assert(tags(content, 'a').some(tag => attribute(tag, 'href') === '#youth-gymnastics-classes'),
      `${label}: missing the jump link to the youth gymnastics comparison`)
    for (const destination of [
      `${HUB_ORIGIN}/gymnastics`,
      `${HUB_ORIGIN}/gymnastics#first-visit`,
      `${HUB_ORIGIN}/gymnastics#youth-gymnastics-schedule`,
      'https://www.thrivegym.org/classes',
      'https://www.docksidersgymnastics.com/class-info',
    ]) {
      assert(nearbyGymnasticsLinks.some(url => url.href === destination),
        `${label}: the youth gymnastics comparison is missing ${destination}`)
    }
    assert(links.some((url) => url.href === 'https://bowiesoccer.com/programs/') && /U4–U10 players without tryouts/.test(content),
      `${label}: missing the sourced comparison of Bowie FC soccer pathways`)
    assert(links.some(url => url.href === 'https://www.bbgc.com/programs/baseball') &&
      /T-ball in 4U or 5U and coach pitch/.test(content),
      `${label}: missing the sourced Bowie recreational baseball divisions`)
    assert(links.some(url => url.href === 'https://southbowiesharks.org/winter-sports-are-open/sbbgcc-basketball/') &&
      /Sharks Squirts group introduces ages 5–8/.test(content),
      `${label}: missing the sourced South Bowie introductory basketball group`)
    const winterSports = content.match(/<section\b[^>]*\sid=["']indoor-winter-sports["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const winterLinks = anchorUrls(winterSports)
    assert(tags(content, 'a').some(tag => attribute(tag, 'href') === '#indoor-winter-sports') &&
      winterLinks.some(url => url.href === 'https://www.marksmenelite.com/marksmen-jr-academy--ages-6-10') &&
      winterLinks.some(url => url.href === 'https://bowiesoccer.com/programs/') &&
      winterLinks.some(url => url.href === 'https://southbowiesharks.org/winter-sports-are-open/sbbgcc-basketball/') &&
      winterLinks.some(url => url.href === `${fitAndFlipCanonical}#fit-flip-schedule`) &&
      hasDropInProgramLink(winterLinks, 'Fit & Flip'),
      `${label}: missing crawlable links to the winter youth sports options`)
    assert(pageIds.has('youth-ice-hockey') && tags(content, 'a').some(tag => attribute(tag, 'href') === '#youth-ice-hockey') &&
      winterLinks.some(url => url.href === 'https://www.cityofbowie.org/485/Lessons-Camps') &&
      winterLinks.some(url => url.href === 'https://www.bowiehockey.org/program/bhc-learn-to-play/13025') &&
      winterLinks.some(url => url.href === 'https://www.bowiehockey.org/program/bhc-recreational-program/12276'),
      `${label}: missing the crawlable path from beginner skating to youth ice hockey`)
    const lowerCost = content.match(/<section\b[^>]*\sid=["']lower-cost-youth-sports["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const lowerCostLinks = anchorUrls(lowerCost)
    assert(tags(content, 'a').some(tag => attribute(tag, 'href') === '#lower-cost-youth-sports') &&
      lowerCostLinks.some(url => url.href === 'https://www.cityofbowie.org/2987/Reduced-Fees-Program') &&
      lowerCostLinks.some(url => url.href === 'https://www.pgparks.com/things-to-do/fee-assistance-scholarships') &&
      lowerCostLinks.some(url => url.href === `${fitAndFlipCanonical}#training-fit`),
      `${label}: missing links to city and county recreation fee assistance or the Fit & Flip trial finder`)
    const training = content.match(/<section\b[^>]*\sid=["']compare-athletic-training["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const trainingLinks = anchorUrls(training)
    assert(tags(content, 'a').some(tag => attribute(tag, 'href') === '#compare-athletic-training') &&
      trainingLinks.some(url => url.href === `${fitAndFlipCanonical}#fit-flip-class-example`) &&
      hasDropInProgramLink(trainingLinks, 'Fit & Flip') &&
      trainingLinks.some(url => url.href === 'https://booking.redlineathletics.com/free-trial-booking-page-bowie') &&
      trainingLinks.some(url => url.href === 'https://www.goatlabperformance.com/programs/youth-athlete-development') &&
      trainingLinks.some(url => url.href === 'https://www.goatlabperformance.com/programs/the-performance-lab'),
      `${label}: missing the crawlable comparison of Fit & Flip, Redline and The GOAT Lab`)
    assert(pageIds.has('high-school-sports-training') &&
      tags(content, 'a').some(tag => attribute(tag, 'href') === '#high-school-sports-training'),
      `${label}: missing the training comparison for high school athletes or its contents link`)
    const homeschool = content.match(/<section\b[^>]*\sid=["']homeschool-pe["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const homeschoolLinks = anchorUrls(homeschool)
    assert(tags(content, 'a').some(tag => attribute(tag, 'href') === '#homeschool-pe') &&
      homeschoolLinks.some(url => url.href === `${HUB_ORIGIN}/gymnastics#youth-gymnastics-schedule`) &&
      homeschoolLinks.some(url => url.href === `${HUB_ORIGIN}/gymnastics#first-visit`) &&
      hasDropInProgramLink(homeschoolLinks, 'Developmental Gymnastics') &&
      homeschoolLinks.some(url => url.href === 'https://www.pgparks.com/your-guide') &&
      homeschoolLinks.some(url => url.href === 'https://www.pgparks.com/facilities/prince-georges-sports-and-learning-complex') &&
      /individual enrollment/.test(homeschool) && /homeschool groups ages 5–17/.test(homeschool),
      `${label}: missing the comparison of regular gymnastics, daytime homeschool classes, and group PE`)
    const youthTeam = content.match(/<section\b[^>]*\sid=["']youth-team-training["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const youthTeamLinks = anchorUrls(youthTeam)
    assert(tags(content, 'a').some(tag => attribute(tag, 'href') === '#youth-team-training') &&
      youthTeamLinks.some(url => url.href === `${fitAndFlipCanonical}#fit-flip-schedule`) &&
      youthTeamLinks.some(url => url.href === 'https://redlineathletics.com/location/bowie/#programs') &&
      youthTeamLinks.some(url => url.href === 'https://www.goatlabperformance.com/programs/team-training'),
      `${label}: missing the youth team training contents link or a verified training option`)
    const fitness = content.match(/<section\b[^>]*\sid=["']fitness-without-a-team["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const fitnessLinks = anchorUrls(fitness)
    assert(tags(content, 'a').some(tag => attribute(tag, 'href') === '#fitness-without-a-team') &&
      fitnessLinks.some(url => url.href === `${HUB_ORIGIN}/gymnastics#teen`) &&
      fitnessLinks.some(url => url.href === 'https://www.pgparks.com/facilities/south-bowie-community-center') &&
      fitnessLinks.some(url => url.href === 'https://www.cityofbowie.org/278/Programs-at-the-Gym'),
      `${label}: missing the local comparison of coached youth gymnastics, open gym, and movement sessions`)
    assert(/\sid=["']parkour-and-ninja["']/.test(fitness) &&
      tags(content, 'a').some(tag => attribute(tag, 'href') === '#parkour-and-ninja') &&
      fitnessLinks.some(url => url.href === 'https://www.pgparks.com/your-guide') &&
      fitnessLinks.some(url => url.href === 'https://www.mga-gymnastics.com/ninja.html') &&
      fitnessLinks.some(url => url.href === 'https://www.skyzone.com/bowie/attractions/ninja-warrior-course/'),
      `${label}: missing parkour and obstacle-course choices or the provider links`)
    assert(/\sid=["']teen-fitness-rooms["']/.test(fitness) &&
      /13–17/.test(fitness) && /13–15/.test(fitness) && /valid fitness pass/.test(fitness) &&
      fitnessLinks.some(url => url.href === `${fitAndFlipCanonical}#fit-flip-schedule`) &&
      fitnessLinks.some(url => url.href === 'https://www.pgparks.com/facilities-rentals/community-center-fees') &&
      fitnessLinks.some(url => url.href === 'https://www.pgparks.com/facilities/bowie-community-center'),
      `${label}: missing the teen fitness room eligibility, county sources, or coached class schedule`)
  }
  if (shouldIndex && pagePath === '/gymnastics') {
    const preschool = html.match(/<article\b[^>]*\sid=["']preschool["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
    const teen = html.match(/<article\b[^>]*\sid=["']teen["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
    const intermediate = html.match(/<article\b[^>]*\sid=["']gymnastics-level-intermediate["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
    assert(anchorUrls(intermediate).some(url => url.href === `${fitAndFlipCanonical}#compare-cyclones-classes`),
      `${label}: intermediate Cyclones readers must have a direct link to compare Fit & Flip`)
    const placement = html.match(/<section\b[^>]*\sid=["']class-placement["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const progress = placement.match(/<article\b[^>]*\sid=["']gymnastics-progress["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
    assert(/coach publishes an evaluation/.test(progress) && /linked Vortex account/.test(progress) &&
      /open Progress/.test(progress) && /Gymnastics Evaluation Reports/.test(progress),
      `${label}: missing the signed-in path for published gymnastics evaluation reports`)
    const pathways = html.match(/<article\b[^>]*\sid=["']youth["'][^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
    const disciplines = html.match(/<section\b[^>]*\sid=["']disciplines["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const team = html.match(/<section\b[^>]*\sid=["']competitive-gymnastics-team["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const homeschool = html.match(/<section\b[^>]*\sid=["']homeschool["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const teamLinks = anchorUrls(team)
    const homeschoolLinks = anchorUrls(homeschool)
    assert(homeschoolLinks.some(url => url.href === `${canonical}#youth-gymnastics-schedule`) &&
      homeschoolLinks.some(url => url.href === `${bowieGuideCanonical}#homeschool-pe`),
      `${label}: the homeschool section must link to class times and the local PE comparison`)
    assert(anchorUrls(preschool).some((url) => url.href === preschoolGuideCanonical),
      `${label}: missing the crawlable guide link in the preschool class section`)
    assert(anchorUrls(teen).some((url) => url.href === `${canonical}#class-placement`),
      `${label}: missing the placement link for experienced and returning gymnasts`)
    assert(anchorUrls(teen).some(url => url.href === `${HUB_ORIGIN}/adult-gymnastics#adult-availability`),
      `${label}: youth gymnastics must link adult readers to the Typhoons trial path`)
    const disciplineLinks = [
      ['artistic', [`${canonical}#choose-a-class`, `${tumblingGuideCanonical}#boys-gymnastics`]],
      ['rhythmic', [`${HUB_ORIGIN}/contact?topic=rhythmic-gymnastics#inquiry`]],
      ['acro', [`${HUB_ORIGIN}/contact?topic=acrobatic-gymnastics#inquiry`]],
      ['aerobic', [`${HUB_ORIGIN}/contact?topic=aerobic-gymnastics#inquiry`]],
    ]
    for (const [id, targets] of disciplineLinks) {
      const topic = disciplines.match(new RegExp(`<article\\b[^>]*\\sid=["']${id}["'][^>]*>[\\s\\S]*?<\\/article>`, 'i'))?.[0] ?? ''
      const links = anchorUrls(topic)
      for (const target of targets) {
        assert(links.some(url => url.href === target), `${label}: gymnastics #${id} must link to ${target}`)
      }
    }
    assert(anchorUrls(disciplines).some(url => url.href === `${HUB_ORIGIN}/contact#gymnastics-equipment`),
      `${label}: gymnastics disciplines must link to the equipment photos`)
    assert(anchorUrls(disciplines).some(url => url.href === `${canonical}#trampoline-tumbling`),
      `${label}: gymnastics disciplines must link to the tumbling and trampoline options`)
    const tumblingSection = html.match(/<section\b[^>]*\sid=["']trampoline-tumbling["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    assert(/<h2\b[^>]*>Tumbling and trampoline training in Bowie<\/h2>/i.test(tumblingSection),
      `${label}: the old tumbling URL must land on a dedicated section heading`)
    const tumblingLinks = anchorUrls(tumblingSection)
    for (const target of [
      `${canonical}#youth-gymnastics-schedule`, `${canonical}#open-free-trial`, `${canonical}#open-free-trial-class-placement`,
      `${fitAndFlipCanonical}#fit-flip-schedule`, `${fitAndFlipCanonical}#body-control`,
      `${tumblingGuideCanonical}#nearby-tumbling-classes`, `${tumblingGuideCanonical}#nearby-trampoline-gymnastics`,
      `${HUB_ORIGIN}/contact?topic=trampoline-tumbling#inquiry`,
    ]) {
      assert(tumblingLinks.some(url => url.href === target), `${label}: the tumbling section must link to ${target}`)
    }
    assert(/Beginner Tornadoes/.test(placement) && /Intermediate Cyclones/.test(placement) && /Advanced Vortex A4 Elite/.test(placement) &&
      /front limber/.test(placement) && /front or back handspring/.test(placement) && /finish in balance/.test(placement) &&
      /Has gymnastics experience/.test(placement) && /Find a free Trial Assessment/.test(placement) &&
      anchorUrls(placement).some(url => url.href === `${canonical}#competitive-gymnastics-team`),
      `${label}: missing the placement comparison or assessment action in the rendered page`)
    assert(anchorUrls(placement).some(url => url.href === `${tumblingGuideCanonical}#handspring-class-placement`),
      `${label}: the class-placement section must link to the handspring comparison`)
    assert(hasProgramTrialLink(placement, 'class-placement'),
      `${label}: the Trial Assessment must work as a native link before startup`)
    assert(anchorUrls(pathways).some(url => url.href === `${canonical}#competitive-gymnastics-team`),
      `${label}: the youth class choices must link to the team comparison`)
    assert(/Competitive gymnastics team in Bowie/.test(team) && /ages 6 and up/.test(team) &&
      /requires an evaluation for placement/.test(team) && /Vortex A4 Elite/.test(team) &&
      teamLinks.some(url => url.href === `${HUB_ORIGIN}/contact#inquiry`) &&
      teamLinks.some(url => url.origin === HUB_ORIGIN && url.pathname === '/enroll' && url.searchParams.get('program') === 'Vortex Gymnastics Team') &&
      teamLinks.some(url => url.href === `${canonical}#class-placement`),
      `${label}: the team section must explain evaluation, developmental options, and link to inquiry and team schedules`)
  }
  if (shouldIndex && canonical === preschoolGuideCanonical) {
    const content = html.match(/<article\b[^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
    const links = anchorUrls(content)
    for (const path of ['/gymnastics#preschool', '/gymnastics#first-visit', '/gymnastics#gymnastics-attire']) {
      assert(links.some((url) => url.href === canonicalFor(HUB_ORIGIN, path)),
        `${label}: missing the crawlable preschool gymnastics guide link to ${path}`)
    }
    assert(['ages-2-3', 'ages-4-5', 'progress'].every((id) => pageIds.has(id)),
      `${label}: missing preschool curriculum or progress sections`)
    const siblings = content.match(/<section\b[^>]*\sid=["']gymnastics-for-siblings["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const siblingLinks = anchorUrls(siblings)
    assert(tags(content, 'a').some(tag => attribute(tag, 'href') === '#gymnastics-for-siblings') &&
      siblingLinks.some(url => url.href === `${HUB_ORIGIN}/gymnastics#youth-gymnastics-schedule`) &&
      siblingLinks.some(url => url.origin === HUB_ORIGIN && url.pathname === '/enroll' &&
        url.searchParams.get('program') === 'Developmental Gymnastics'),
      `${label}: the siblings section must link families to scoped enrollment and current weekly times`)
    const youngerToddlers = content.match(/<section\b[^>]*\sid=["']gymnastics-before-age-2["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const countyLinks = anchorUrls(youngerToddlers)
    assert(tags(content, 'a').some(tag => attribute(tag, 'href') === '#gymnastics-before-age-2') &&
      countyLinks.some(url => url.href === 'https://www.pgparks.com/your-guide') &&
      countyLinks.some(url => url.href === 'https://www.pgparks.com/facilities/fairland-aquatic-center'),
      `${label}: missing the under-two gymnastics option or the county's official links`)
  }
  if (shouldIndex && pagePath === '/fit-and-flip') {
    const articleTag = tags(html, 'article').find(tag => attribute(tag, 'id') === 'body-control')
    const topic = articleTag ? html.slice(html.indexOf(articleTag)).split('</article>', 1)[0] : ''
    assert(anchorUrls(topic).some((url) => url.href === tumblingGuideCanonical),
      `${label}: the tumbling topic must link to the comparison guide`)
  }
  if (shouldIndex && canonical === tumblingGuideCanonical) {
    const content = html.match(/<article\b[^>]*>[\s\S]*?<\/article>/i)?.[0] ?? ''
    const lead = content.match(/<p\b[^>]*class=["']athletic-guide-lead["'][^>]*>[\s\S]*?<\/p>/i)?.[0] ?? ''
    assert(anchorUrls(lead).some(url => url.href === `${HUB_ORIGIN}/gymnastics#trampoline-tumbling`) &&
      tags(lead, 'a').some(tag => attribute(tag, 'href') === '#nearby-tumbling-classes'),
      `${label}: the guide intro must offer direct paths to Vortex instruction and dedicated tumbling classes`)
    const links = anchorUrls(content)
    for (const path of ['/gymnastics#beginner', '/gymnastics#class-placement', '/fit-and-flip#body-control', '/read-board#classes',
      '/#free-trial', `${BOWIE_YOUTH_SPORTS_GUIDE_PATH}#youth-gymnastics-classes`]) {
      assert(links.some((url) => url.href === canonicalFor(HUB_ORIGIN, path)),
        `${label}: missing the crawlable comparison guide link to ${path}`)
    }
    const tumblingSkills = content.match(/<section\b[^>]*\sid=["']where-tumbling-fits["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    assert(anchorUrls(tumblingSkills).some(url => url.href === `${watchUrl}#gymnastics-skills`),
      `${label}: the floor and track explanation must link to the corresponding film scene`)
    const handspring = content.match(/<h3\b[^>]*\sid=["']handspring-class-placement["'][^>]*>[\s\S]*?<\/h3>(?:\s*<p\b[^>]*>[\s\S]*?<\/p>){2}/i)?.[0] ?? ''
    const handspringLinks = anchorUrls(handspring)
    assert(tags(content, 'a').some(tag => attribute(tag, 'href') === '#handspring-class-placement') &&
      handspringLinks.some(url => url.href === 'https://www.trainforgreatnessmd.com/tumbling') &&
      handspringLinks.some(url => url.href === `${HUB_ORIGIN}/gymnastics#class-placement`),
      `${label}: the handspring comparison must link to its provider source and Vortex class placement`)
    const nearbyTumbling = content.match(/<section\b[^>]*\sid=["']nearby-tumbling-classes["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const nearbyTumblingLinks = anchorUrls(nearbyTumbling)
    for (const provider of [
      'https://www.trainforgreatnessmd.com/tumbling',
      'https://www.trainforgreatnessmd.com/private-lessons',
      'https://www.marlborocheer.org/tumbling.php',
      'https://www.mga-gymnastics.com/tumbling.html',
      'https://www.platinumforceathletics.com/tumbling-classes',
      'https://www.pgparks.com/your-guide',
    ]) {
      assert(nearbyTumblingLinks.some(url => url.href === provider),
        `${label}: missing the dedicated tumbling provider link to ${provider}`)
    }
    const nearbyTrampoline = content.match(/<section\b[^>]*\sid=["']nearby-trampoline-gymnastics["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const nearbyTrampolineLinks = anchorUrls(nearbyTrampoline)
    assert(tags(content, 'a').some(tag => attribute(tag, 'href') === '#nearby-trampoline-gymnastics'),
      `${label}: missing the jump link to the coached trampoline comparison`)
    for (const destination of [
      'https://www.docksidersgymnastics.com/special-programs',
      'https://www.pgparks.com/your-guide',
      'https://www.trainforgreatnessmd.com/services',
      `${HUB_ORIGIN}/contact?topic=trampoline-tumbling#inquiry`,
    ]) {
      assert(nearbyTrampolineLinks.some(url => url.href === destination),
        `${label}: the coached trampoline comparison is missing ${destination}`)
    }
    const boysGymnastics = content.match(/<section\b[^>]*\sid=["']boys-gymnastics["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const boysGymnasticsLinks = anchorUrls(boysGymnastics)
    for (const destination of [
      `${HUB_ORIGIN}/gymnastics#first-visit`,
      'https://members.usagym.org/pages/gymnastics101/men/events.html',
      'https://www.mga-gymnastics.com/boys.html',
      'https://www.pgparks.com/your-guide',
    ]) {
      assert(boysGymnasticsLinks.some(url => url.href === destination),
        `${label}: the boys’ gymnastics comparison is missing ${destination}`)
    }
    const accessibleGymnastics = content.match(/<section\b[^>]*\sid=["']accessible-gymnastics["'][^>]*>[\s\S]*?<\/section>/i)?.[0] ?? ''
    const accessibleLinks = anchorUrls(accessibleGymnastics)
    assert(tags(content, 'a').some(tag => attribute(tag, 'href') === '#accessible-gymnastics') &&
      accessibleLinks.some(url => url.href === 'https://www.eagcgym.com/recclasses') &&
      accessibleLinks.some(url => url.href === 'https://www.pgparks.com/things-to-do/disability-services#disability') &&
      accessibleLinks.some(url => url.href === 'https://www.pgparks.com/facilities/prince-georges-sports-and-learning-complex') &&
      accessibleLinks.some(url => url.href === `${HUB_ORIGIN}/contact#inquiry`),
      `${label}: missing links to adaptive gymnastics, county Program Access, or the Vortex inquiry form`)
  }

  if (requireSchema) {
    assert(jsonLd.length >= 2, `${label}: expected the Bowie business and WebSite JSON-LD`)
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
    const locationId = `${HUB_ORIGIN}/#location`
    const locations = parsed.filter(item => item?.['@type'] === 'SportsActivityLocation')
    const location = locations[0]
    const website = parsed.find(item => item?.['@type'] === 'WebSite')
    assert(locations.length === 1 && location['@id'] === locationId && !types.includes('Organization'),
      `${label}: one business entity must represent the local facility and organization`)
    assert(location?.legalName === 'Vortex Athletics, LLC' && location?.logo === `${HUB_ORIGIN}/red_vortex.png` &&
      location?.contactPoint?.telephone === location.telephone, `${label}: missing business identity or contact information`)
    assert(website?.publisher?.['@id'] === locationId, `${label}: website publisher must reference the Bowie business`)
    if (canonical === watchUrl) {
      const page = parsed.find(item => item?.['@type'] === 'WebPage')
      const videos = parsed.filter(item => item?.['@type'] === 'VideoObject')
      const video = videos[0]
      const { name, description, uploadDate, durationSeconds } = PUBLIC_TRAINING_VIDEO
      const validUploadDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(uploadDate) &&
        isCalendarDate(uploadDate.slice(0, 10)) && Number.isFinite(Date.parse(uploadDate))
      assert(videos.length === 1 && video?.name === name && video?.description === description &&
        video?.contentUrl === videoUrl && video?.thumbnailUrl?.length === 1 && video.thumbnailUrl[0] === videoThumbnailUrl &&
        ogImages[0] === videoThumbnailUrl && video.uploadDate === uploadDate && validUploadDate &&
        video.duration === `PT${durationSeconds}S` && video.publisher?.['@id'] === locationId &&
        page?.url === canonical && page?.mainEntity?.['@id'] === video['@id'] && video?.mainEntityOfPage?.['@id'] === page?.['@id'],
        `${label}: VideoObject must describe the visible film and be the main entity of its page`)
    } else {
      assert(!types.includes('VideoObject'), `${label}: VideoObject must only appear on the training watch page`)
    }
    if (pagePath === '/') {
      const home = parsed.find(item => item?.['@type'] === 'WebPage')
      assert(home?.url === HUB_ORIGIN && home?.primaryImageOfPage === homePreviewUrl,
        `${label}: the homepage must identify its published training photo as its preferred search image`)
    }

    if (pagePath === '/adult-gymnastics' || pagePath === '/drop-in') {
      const question = pagePath === '/drop-in' ? 'Which drop-in dates accept a free trial?' : 'Can I try adult gymnastics for free?'
      const faq = parsed.find((item) => item?.['@type'] === 'FAQPage')
      const answer = faq?.mainEntity?.find((item) => item.name === question)?.acceptedAnswer?.text
      const visibleFaqs = [...html.matchAll(/<details\b[^>]*>[\s\S]*?<\/details>/gi)].map(([entry]) => entry)
      const visibleFaq = visibleFaqs.find(entry => entry.includes(question)) ?? ''
      assert(answer && /Accepts free trials/.test(answer) && /unused one-time (free )?trial/i.test(answer) &&
        decodeHtml(visibleFaq).includes(answer), `${label}: the visible trial eligibility answer must match FAQ structured data`)
      if (pagePath === '/adult-gymnastics') {
        const ageQuestion = 'Is there an upper age limit for adult gymnastics?'
        const ageAnswer = faq?.mainEntity?.find(item => item.name === ageQuestion)?.acceptedAnswer?.text
        const visibleAgeFaq = visibleFaqs.find(entry => entry.includes(ageQuestion)) ?? ''
        assert(ageAnswer && /\bno upper age limit\b/i.test(ageAnswer) && decodeHtml(visibleAgeFaq).includes(ageAnswer),
          `${label}: the visible adult age limit answer must match FAQ structured data`)
      }
    }

    if (HUB_ARTICLE_PATHS.includes(pagePath)) {
      const article = parsed.find((item) => item?.['@type'] === 'Article')
      const breadcrumb = parsed.find((item) => item?.['@type'] === 'BreadcrumbList')
      assert(breadcrumb?.itemListElement?.[1]?.item === canonicalFor(HUB_ORIGIN, HUB_GUIDE_INDEX_PATH),
        `${label}: article breadcrumb structured data must include the guide index`)
      assert(article?.mainEntityOfPage === canonical && article?.headline === h1s[0],
        `${label}: Article JSON-LD must match the canonical URL and visible heading`)
      assert(article?.image === ogImages[0], `${label}: Article JSON-LD must match the preferred preview image`)
      assert(article?.author?.['@id'] === locationId && article?.publisher?.['@id'] === locationId,
        `${label}: the guide must credit the shared business entity`)
      const visibleDates = tags(html, 'time').map((tag) => attribute(tag, 'datetime'))
      const sitemapDate = HUB_SITEMAP_ENTRIES.find(({ path }) => path === pagePath)?.lastmod
      assert(isCalendarDate(article?.datePublished) && isCalendarDate(article?.dateModified) && article.datePublished <= article.dateModified,
        `${label}: Article JSON-LD must have a publication date on or before the update date`)
      assert(article?.dateModified === sitemapDate && [article?.datePublished, article?.dateModified].every((date) => visibleDates.includes(date)),
        `${label}: Article dates must match the visible dates and sitemap update date`)
    }

    if (pagePath === HUB_GUIDE_INDEX_PATH) {
      const collection = parsed.find((item) => item?.['@type'] === 'CollectionPage')
      const list = collection?.mainEntity
      assert(collection?.url === canonical && collection?.name === h1s[0] && list?.['@type'] === 'ItemList' &&
        list?.numberOfItems === HUB_ARTICLE_PATHS.length &&
        list.itemListElement?.length === HUB_ARTICLE_PATHS.length &&
        list.itemListElement.every((item, index) => item.position === index + 1 && item.url === canonicalFor(HUB_ORIGIN, HUB_ARTICLE_PATHS[index])),
        `${label}: the guide index structured data must match the published guide collection`)
    }

    if (['/', '/contact', ...publicServicePaths].includes(pagePath)) {
      const locationUrl = `${HUB_ORIGIN}/contact`
      assert(location?.url === locationUrl && location.mainEntityOfPage === locationUrl,
        `${label}: SportsActivityLocation must identify the shared Bowie location`)
      assert(
        location?.name === 'Vortex Athletics and Gymnastics',
        `${label}: local business name does not match the Google Business Profile`,
      )
      assert(
        location?.telephone === '+14434224794',
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
      assert(location?.sameAs?.includes('https://nextdoor.com/pages/vortex-athletics-gymnastics-bowie-md/'),
        `${label}: the local business should reference its verified Nextdoor listing`)
      assert(location?.sameAs?.includes('https://www.yelp.com/biz/vortex-athletics-and-gymnastics-bowie-3'),
        `${label}: the local business should reference its claimed Yelp listing`)
      assert(location?.areaServed === 'Bowie, MD', `${label}: the facility must describe where classes are held`)
      if (pagePath === '/') {
        const items = location?.hasOfferCatalog?.itemListElement ?? []
        assert(location?.hasOfferCatalog?.['@type'] === 'OfferCatalog' && items.length === publicServicePaths.length,
          `${label}: the catalog must list the public Vortex services`)
        for (const path of publicServicePaths) {
          const url = `${HUB_ORIGIN}${path}`
          assert(items.some(({ itemOffered }) => itemOffered?.url === url && itemOffered['@id'] === `${url}#service` &&
            itemOffered.provider?.['@id'] === locationId), `${label}: the catalog must link ${path} to the Bowie facility`)
        }
        const dropIn = items.find(({ itemOffered }) => itemOffered?.url === `${HUB_ORIGIN}/drop-in`)?.itemOffered
        assert(/adult gymnastics/i.test(dropIn?.serviceType ?? ''), `${label}: the drop-in catalog must include adult gymnastics`)
      }
      if (publicServicePaths.includes(pagePath)) {
        const service = parsed.find((item) => item?.['@type'] === 'Service')
        assert(service?.url === canonical && service['@id'] === `${canonical}#service`,
          `${label}: Service identity must match the canonical page`)
        assert(service?.provider?.['@id'] === locationId && service.availableChannel?.serviceLocation?.['@id'] === locationId &&
          service.areaServed === location?.areaServed, `${label}: Service must point to the Bowie facility`)
        if (pagePath === '/drop-in') {
          assert(/adult gymnastics/i.test(service?.serviceType ?? ''), `${label}: the drop-in service must include adult gymnastics`)
        }
      }
      if (pagePath === '/contact') {
        const contactPage = parsed.find(item => item?.['@type'] === 'ContactPage')
        assert(contactPage?.['@id'] === canonical && contactPage?.url === canonical && contactPage?.name === h1s[0] &&
          contactPage?.isPartOf?.['@id'] === website?.['@id'] && contactPage?.mainEntity?.['@id'] === locationId &&
          contactPage?.primaryImageOfPage === location?.image,
          label + ': ContactPage must identify the same Bowie facility as the site and visible contact information')
        assert(tags(html, 'img').some((tag) => `${HUB_ORIGIN}${attribute(tag, 'src')}` === location?.image && attribute(tag, 'alt')),
          `${label}: the facility photo in structured data must be visible on Contact`)
        assert(ogImages[0] === location?.image, `${label}: the contact page preview must use the Bowie facility photo`)
      }
      if (['/contact', ...HUB_PROGRAM_PATHS].includes(pagePath)) {
        assert(anchorUrls(html).some(isBowieDirections),
        `${label}: expected directions to the verified Bowie listing`)
      }
    }
    const showsFacilityHours = ['/', '/contact', '/support', ...HUB_PROGRAM_PATHS].includes(pagePath)
    if (showsFacilityHours) {
      const hours = location?.openingHoursSpecification ?? []
      assert(hours.length === 2 && hours[0]?.opens === '16:00' && hours[0]?.closes === '20:30' &&
        hours[1]?.opens === '09:00' && hours[1]?.closes === '12:00' &&
        decodeHtml(html).includes('Mon-Fri: 4:00-8:30 PM') && decodeHtml(html).includes('Sat: 9:00 AM-12:00 PM'),
        `${label}: structured facility hours must match the visible hours`)
    } else {
      assert(!location?.openingHoursSpecification, `${label}: facility hours in structured data must be visible on the page`)
    }
  }
}

const sitemapImages = [...new Set(HUB_SITEMAP_ENTRIES.flatMap(({ images = [] }) => images))]
  .map((image) => new URL(image, HUB_ORIGIN))
for (const url of sitemapImages) {
  assert(url.origin === HUB_ORIGIN && !url.search && !url.hash && /\.(webp|png|jpe?g|avif)$/i.test(url.pathname),
    `sitemap: expected an unparameterized photo on the canonical host (${url.href})`)
  const file = join(root, 'dist', url.pathname.replace(/^\//, ''))
  assert(existsSync(file) && statSync(file).size > 0 && statSync(file).size <= 1024 * 1024,
    `sitemap: expected a valid photo of at most 1 MiB (${url.pathname})`)
}
for (const asset of [PUBLIC_TRAINING_VIDEO.assetPath, PUBLIC_TRAINING_VIDEO.thumbnail, videoDescriptionsPath, '/favicon.png']) {
  const file = join(root, 'dist', asset.slice(1))
  assert(existsSync(file) && statSync(file).size > 0, `dist: missing the public asset ${asset}`)
}
const faviconPath = join(root, 'dist/favicon.png')
if (existsSync(faviconPath)) {
  const favicon = readFileSync(faviconPath)
  assert(favicon.length >= 26 && favicon.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' &&
    favicon.readUInt32BE(16) === 192 && favicon.readUInt32BE(20) === 192,
    'dist: the public favicon must be a 192×192 PNG')
}

for (const set of expectedSets) {
  const xml = readFileSync(join(root, set.sitemapPath), 'utf8')
  const actualUrls = extractUrls(xml)
  const expectedUrls = set.entries.map(({ path }) => canonicalFor(set.origin, path))

  assert(actualUrls.length === expectedUrls.length, `${set.label} sitemap: found ${actualUrls.length}, expected ${expectedUrls.length}`)
  assert(new Set(actualUrls).size === actualUrls.length, `${set.label} sitemap: duplicate URLs found`)
  assert(expectedUrls.every((url) => actualUrls.includes(url)), `${set.label} sitemap: URL set differs from SEO configuration`)
  verifySitemapEntries(`${set.label} sitemap`, xml, set)
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
      verifySitemapEntries(`${set.label} live sitemap`, remoteXml, set)
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

    for (const path of set.noindexPaths) {
      const canonical = canonicalFor(set.origin, path)
      const response = await fetch(canonical, { redirect: 'manual' })
      assert(response.status === 200 && /\bnoindex\b/i.test(response.headers.get('x-robots-tag') ?? ''),
        `${canonical}: expected a public page with an HTTP noindex directive`)
      if (response.ok) verifyHtml(`live ${canonical}`, await response.text(), canonical, { shouldIndex: false })
    }

    const consentMappings = [...normalizedConsentPaths.map(path => [path, path]), ...legacyNormalizedConsentPaths]
    const consentVariants = consentMappings.flatMap(([path, destination]) => [[path, destination], [`${path}/`, destination]])
    await Promise.all(consentVariants.map(async ([path, destination]) => {
      const consentDestination = new URL(destination, set.origin)
      consentDestination.searchParams.append('utm_source', 'seo_release_check')
      consentDestination.searchParams.append('tag', 'one')
      consentDestination.searchParams.append('tag', 'two')
      const consentId = 'c_consent_release_check'
      const consentSource = new URL(path, set.origin)
      consentSource.searchParams.append('utm_source', 'seo_release_check')
      consentSource.searchParams.append('tag', 'one')
      consentSource.searchParams.append(consentQueryParam, consentId)
      consentSource.searchParams.append('tag', 'two')
      const consentRedirect = await fetch(consentSource, { redirect: 'manual' })
      await consentRedirect.body?.cancel()
      const consentLocation = consentRedirect.headers.get('location')
      const consentTarget = consentLocation ? new URL(consentLocation, consentSource) : null
      assert(consentRedirect.status === 308 && consentTarget?.href === consentDestination.href,
        path + ': one permanent redirect must remove vcid, retain other parameters, and use only the mapped fragment')
      assert(/\bprivate\b/.test(consentRedirect.headers.get('cache-control') ?? '') && /\bno-store\b/.test(consentRedirect.headers.get('cache-control') ?? '') &&
        (consentRedirect.headers.get('set-cookie') ?? '').startsWith('_vortex_cid=' + consentId + ';') &&
        !/\bnoindex\b/i.test(consentRedirect.headers.get('x-robots-tag') ?? ''),
        path + ': the indexable redirect must preserve the necessary consent cookie and forbid shared caching')
      const normalizedConsentPage = await fetch(consentDestination, { redirect: 'manual' })
      assert(normalizedConsentPage.ok && !/\bnoindex\b/i.test(normalizedConsentPage.headers.get('x-robots-tag') ?? '') &&
        linkValues(await normalizedConsentPage.text(), 'canonical').includes(canonicalFor(set.origin, consentDestination.pathname)),
        path + ': the clean consent destination must stay indexable and self-canonical')
    }))

    await Promise.all(consentVariantPaths.map(async (path) => {
      const canonical = canonicalFor(set.origin, path)
      const url = new URL(canonical)
      url.searchParams.set(consentQueryParam, 'c_seo_release_check')
      url.searchParams.set('utm_source', 'seo_release_check')
      const label = `${canonical} with ${consentQueryParam}`
      const response = await fetch(url, { redirect: 'manual' })
      const html = await response.text()
      assert(response.ok, `${label}: returned HTTP ${response.status}; consent handoff requires a page response`)
      assert(/\bnoindex\b/i.test(response.headers.get('x-robots-tag') ?? ''),
        `${label}: legacy consent URLs must have an HTTP noindex directive`)
      const canonicals = linkValues(html, 'canonical')
      const ogUrls = metaValues(html, 'property', 'og:url')
      assert(canonicals.length === 1 && canonicals[0] === canonical,
        `${label}: expected one canonical matching the clean URL`)
      assert(ogUrls.length === 1 && ogUrls[0] === canonical,
        `${label}: expected one og:url matching the clean URL`)
    }))

    for (const path of ['/?utm_source=seo_release_check', '/drop-in?program=Adult+Fitness+%26+Acrobatics']) {
      const response = await fetch(`${set.origin}${path}`, { redirect: 'manual' })
      await response.body?.cancel()
      assert(response.ok && !/\bnoindex\b/i.test(response.headers.get('x-robots-tag') ?? ''),
        `${path}: booking and campaign URLs must remain available without a noindex header`)
    }

    for (const path of ['/', '/gymnastics']) {
      const previewUrl = `${set.origin}${path}?sport=soccer&${consentQueryParam}=c_seo_release_check`
      const previewWithConsent = await fetch(previewUrl, { redirect: 'manual' })
      await previewWithConsent.body?.cancel()
      const robotsTag = previewWithConsent.headers.get('x-robots-tag') ?? ''
      assert(previewWithConsent.ok && /\bnoindex\b/i.test(robotsTag) && /\bnofollow\b/i.test(robotsTag),
        `${previewUrl}: a legacy consent ID must preserve the sport preview header and bypass normalization`)
    }

    for (const path of ['/admin', '/?sport=soccer', ...SPA_ONLY_PATHS]) {
      const response = await fetch(`${set.origin}${path}`, { redirect: 'follow' })
      if (path === '/admin' && response.status === 404) {
        await response.body?.cancel()
        continue
      }
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
    const navigation = { redirect: 'manual', headers: { Accept: 'text/html' } }
    const notFoundResponse = await fetch(notFoundUrl, navigation)
    assert(notFoundResponse.status === 404 && /^text\/html\b/i.test(notFoundResponse.headers.get('content-type') ?? ''),
      `${notFoundUrl}: missing a branded HTML response with HTTP 404`)
    verifyPublicNotFoundHtml(notFoundUrl, await notFoundResponse.text())

    const notFoundHead = await fetch(notFoundUrl, { ...navigation, method: 'HEAD' })
    assert(notFoundHead.status === 404 && /^text\/html\b/i.test(notFoundHead.headers.get('content-type') ?? ''),
      `${notFoundUrl}: HEAD must report the branded HTML response and HTTP 404`)

    for (const path of ['/api/__seo-release-404-check__', '/assets/__seo-release-404-check__.js']) {
      const response = await fetch(`${set.origin}${path}`, navigation)
      assert(response.status === 404 && !h1Values(await response.text()).some((heading) => /that page isn/i.test(heading)),
        `${path}: API and asset misses must keep their existing 404 responses`)
    }
  }
}

if (live) {
  const athleticsWwwOrigin = 'https://www.vortexathletics.com'
  const gymnasticsApexOrigin = 'https://vortex-gymnastics.com'
  const verifyLiveRedirect = async (source, destination) => {
    let current = source
    for (let hop = 0; hop < 3; hop += 1) {
      const response = await fetch(current, { redirect: 'manual' })
      await response.body?.cancel()
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

      const aliasTarget = current.origin === athleticsWwwOrigin
        ? new URL(current.pathname + current.search + current.hash, HUB_ORIGIN)
        : undefined
      const aliasRedirect = permanent && next.href === aliasTarget?.href
      if (!aliasRedirect) {
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

  const verifyTrackedRedirect = async (path, target, query = {}, origins = [HUB_ORIGIN, ...aliasOrigins]) => {
    const destination = new URL(target, HUB_ORIGIN)
    for (const [key, value] of Object.entries(query)) destination.searchParams.set(key, value)
    destination.searchParams.set('utm_source', 'seo-release-check')
    destination.searchParams.append('tag', 'one')
    destination.searchParams.append('tag', 'two')
    for (const origin of origins) {
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
    '/artistic-gymnastics',
    '/rhythmic-gymnastics',
    '/acro-gymnastics',
    '/aerobic-gymnastics',
    '/trampoline-tumbling',
  ]) {
    await verifyTrackedRedirect(path, legacyLandingRedirects[path])
    await verifyTrackedRedirect(`${path}/`, legacyLandingRedirects[path])
  }

  await verifyTrackedRedirect('/trampoline-tumbling', legacyLandingRedirects['/trampoline-tumbling'], {
    [consentQueryParam]: 'c_consent_release_check',
  }, [gymnasticsApexOrigin, GYMNASTICS_ORIGIN])
  await verifyTrackedRedirect('/trampoline-tumbling/index.html/', legacyLandingRedirects['/trampoline-tumbling'])
  await verifyTrackedRedirect('/gymnastics/index.html/', '/gymnastics')

  const wwwConsentSource = new URL('/trampoline-tumbling', athleticsWwwOrigin)
  wwwConsentSource.searchParams.set(consentQueryParam, 'c_consent_release_check')
  wwwConsentSource.searchParams.set('utm_source', 'seo-release-check')
  const wwwConsentDestination = new URL(legacyLandingRedirects['/trampoline-tumbling'], HUB_ORIGIN)
  wwwConsentDestination.searchParams.set('utm_source', 'seo-release-check')
  await verifyLiveRedirect(wwwConsentSource, wwwConsentDestination)

  const bookingQuery = { form: '42', offeringId: '3', slotGroupId: '5', timeSlotId: '6' }
  for (const path of ['/schedule', '/scheduling']) {
    await verifyTrackedRedirect(path, legacyLandingRedirects[path], bookingQuery)
    await verifyTrackedRedirect(`${path}/`, legacyLandingRedirects[path], bookingQuery)
  }

  for (const path of [...HUB_PROGRAM_PATHS, HUB_GUIDE_INDEX_PATH, ...HUB_ARTICLE_PATHS]) {
    await verifyTrackedRedirect(`${path}/`, path)
  }

  await Promise.all(HUB_PRERENDER_PATHS.map((path) => verifyTrackedRedirect(snapshotAliasFor(path), path)))
  await Promise.all(retiredSnapshotRoutes.map(([path, target]) => verifyTrackedRedirect(path, target)))
  for (const path of ['/__seo-release-404-check__/index.html', '/blog/__seo-release-404-check__/index.html', '/gymnastics/indexXhtml', '/_gym/__seo-release-404-check__.html']) {
    const response = await fetch(new URL(path, HUB_ORIGIN), { redirect: 'manual' })
    await response.body?.cancel()
    assert(response.status === 404, `${path}: expected HTTP 404 for an unknown snapshot file, received ${response.status}`)
  }

  for (const [source, destination] of [
    [`${HUB_ORIGIN}/sitemap-gymnastics.xml`, `${HUB_ORIGIN}/sitemap.xml`],
    [`${GYMNASTICS_ORIGIN}/sitemap.xml`, `${HUB_ORIGIN}/sitemap.xml`],
    [`${GYMNASTICS_ORIGIN}/sitemap-gymnastics.xml`, `${HUB_ORIGIN}/sitemap.xml`],
    ['https://vortex-gymnastics.com/sitemap.xml', `${HUB_ORIGIN}/sitemap.xml`],
  ]) {
    const response = await fetch(source, { redirect: 'follow' })
    await response.body?.cancel()
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
    await response.body?.cancel()
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
    await response.body?.cancel()
    const cacheControl = (response.headers.get('cache-control') ?? '').toLowerCase()
    assert(response.ok, `${url}: social image returned HTTP ${response.status}`)
    assert(!cacheControl.includes('no-store'), `${url}: public social image must not use no-store`)
  }
  await Promise.all(sitemapImages.map(async (url) => {
    const response = await fetch(url, { redirect: 'manual' })
    await response.body?.cancel()
    assert(response.ok && (response.headers.get('content-type') ?? '').startsWith('image/'),
      `${url.href}: sitemap photo must return an image directly (HTTP ${response.status})`)
    assert(!/\b(?:noindex|noimageindex)\b/i.test(response.headers.get('x-robots-tag') ?? ''),
      `${url.href}: sitemap photo is excluded from image indexing`)
  }))
  await Promise.all([768, 1080, 1600].map(async width => {
    const url = `${HUB_ORIGIN}/gymnastics-hero-${width}.avif`
    const response = await fetch(url, { redirect: 'manual' })
    await response.body?.cancel()
    assert(response.ok && /^image\/avif\b/i.test(response.headers.get('content-type') ?? '') &&
      !/\b(?:noindex|noimageindex)\b/i.test(response.headers.get('x-robots-tag') ?? ''),
      `${url}: the responsive AVIF must be served directly as a crawlable image`)
  }))
  await Promise.all([videoThumbnailUrl, fitAndFlipPreviewUrl, `${HUB_ORIGIN}/favicon.png`].map(async (url) => {
    const response = await fetch(url, { redirect: 'manual' })
    await response.body?.cancel()
    assert(response.ok && (response.headers.get('content-type') ?? '').startsWith('image/') &&
      !/\b(?:noindex|noimageindex)\b/i.test(response.headers.get('x-robots-tag') ?? ''),
      `${url}: the image must be directly available and crawlable`)
  }))
  const videoResponse = await fetch(videoUrl, { headers: { Range: 'bytes=0-63' }, redirect: 'manual' })
  await videoResponse.body?.cancel()
  assert(videoResponse.status === 206 && /^video\/mp4\b/i.test(videoResponse.headers.get('content-type') ?? '') &&
    /^bytes 0-63\/\d+$/.test(videoResponse.headers.get('content-range') ?? '') &&
    !/\bnoindex\b/i.test(videoResponse.headers.get('x-robots-tag') ?? ''),
    `${videoUrl}: the video must be crawlable and support byte-range playback`)
  const descriptionResponse = await fetch(new URL(videoDescriptionsPath, HUB_ORIGIN), { redirect: 'manual' })
  assert(descriptionResponse.ok && /^text\/vtt\b/i.test(descriptionResponse.headers.get('content-type') ?? '') &&
    (await descriptionResponse.text()).startsWith('WEBVTT'),
    `${videoDescriptionsPath}: expected a directly available WebVTT description track`)
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

verifyPublicNotFoundHtml('public/404.html', readFileSync(join(root, 'public/404.html'), 'utf8'))

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

for (const path of [HUB_GUIDE_INDEX_PATH, ...HUB_ARTICLE_PATHS, PUBLIC_TRAINING_VIDEO.path]) {
  assert(PUBLIC_EDITORIAL_PAGES.some((page) => page.path === path),
    `analytics: published editorial path is missing from reporting: ${path}`)
}

const vercelConfig = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
const redirects = vercelConfig.redirects ?? []
const slashFallback = redirects.at(-1)
assert(vercelConfig.trailingSlash === undefined && slashFallback?.source === '/:path((?:[^/]+/)*[^/]+)/' &&
  slashFallback.destination === '/:path' && slashFallback.permanent === true && !slashFallback.has,
  'vercel.json: normalize slashes after the specific redirects')
const headers = vercelConfig.headers ?? []
const rewrites = vercelConfig.rewrites ?? []
const publicNotFoundHandler = 'api/public-not-found.ts'
const publicNotFoundRewrite = rewrites.at(-1)
assert(publicNotFoundRewrite?.destination === '/' + publicNotFoundHandler &&
  publicNotFoundRewrite.has?.some((condition) => condition.type === 'header' && condition.key === 'accept' &&
    new RegExp(condition.value).test('text/html')) &&
  vercelConfig.builds?.some((build) => build.src === publicNotFoundHandler && build.use === '@vercel/node' &&
    build.config?.includeFiles?.includes('public/404.html')),
  'vercel.json: the last rewrite must serve the packaged branded 404 for document requests')
const redirectFor = (host, source, destination) =>
  redirects.some(
    (redirect) =>
      redirect.source === (source === '/' ? source : `${source}{/}?`) &&
      redirect.destination === destination &&
      redirect.permanent === true &&
      redirect.has?.some((condition) => condition.type === 'host' && new RegExp(`^(?:${condition.value})$`).test(host)),
  )
const hubPages = HUB_PRERENDER_PATHS.filter((path) => /^\/[^/]+$/.test(path)).map((path) => path.slice(1))
const hubArticles = HUB_ARTICLE_PATHS.map((path) => path.slice('/blog/'.length))
const snapshotRedirectRules = [
  [snapshotAliasFor('/'), '/'],
  [snapshotAliasFor(`/:page(${hubPages.join('|')})`), '/:page'],
  [snapshotAliasFor(`/blog/:article(${hubArticles.join('|')})`), '/blog/:article'],
  [snapshotAliasFor(PUBLIC_TRAINING_VIDEO.path), PUBLIC_TRAINING_VIDEO.path],
  ...retiredSnapshotRoutes,
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
const normalizedConsentSlugs = normalizedConsentPaths.map(path => path.slice(1)).join('|')
assert(headers.some(rule => rule.source === '/:path((?!(?:' + normalizedConsentSlugs + ')$).*)' && hasNoindexHeader(rule) &&
  rule.has?.some(condition => condition.type === 'host' && condition.value === 'vortexathletics\\.com') &&
  rule.has?.some(condition => condition.type === 'query' && condition.key === consentQueryParam)),
  'vercel.json: legacy consent query URLs outside the normalized paths must have a noindex header on the canonical host')
const consentHandler = 'api/legacy-public-consent.ts'
const findConsentRewrite = (slugs) => vercelConfig.routes?.find(rule => rule.src === '^/(' + slugs + ')/?$' &&
  rule.dest === '/' + consentHandler && !rule.check && rule.methods?.join(' ') === 'GET HEAD' &&
  rule.has?.some(condition => condition.type === 'host' &&
    condition.value === '(?:vortexathletics\\.com|vortex-[a-z0-9-]+-3lisports\\.vercel\\.app)') &&
  rule.has?.some(condition => condition.type === 'query' && condition.key === consentQueryParam) &&
  rule.missing?.some(condition => condition.type === 'query' && condition.key === 'sport'))
const currentConsentRewrite = findConsentRewrite(normalizedConsentSlugs)
const retiredConsentRewrite = findConsentRewrite(legacyNormalizedConsentPaths.map(([path]) => path.slice(1)).join('|'))
assert(vercelConfig.builds?.some(build => build.src === consentHandler && build.use === '@vercel/node' &&
  build.config?.includeFiles?.includes('src/config/publicLandingRedirects.json')) &&
  currentConsentRewrite,
  'vercel.json: normalized consent requests must reach the Node handler before the static pages')
assert(retiredConsentRewrite,
  'vercel.json: the consent handler must intercept each retired path whose destination already normalizes consent')
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
    return [path, `${path}{/}?`].includes(rule.source) && (!host || new RegExp(`^(?:${host.value})$`).test(new URL(HUB_ORIGIN).host))
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
assert(vercelConfig.routes?.length === 2 && currentConsentRewrite && retiredConsentRewrite,
  'vercel.json: only the scoped consent rewrites belong before static routing')
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

const indexNowKey = live || process.env.VERCEL_ENV === 'production' ? getIndexNowVerificationKey() : undefined
if (indexNowKey) {
  const fileName = `${indexNowKey}.txt`
  if (live) {
    try {
      const response = await fetch(new URL(fileName, HUB_ORIGIN), {
        redirect: 'manual', signal: AbortSignal.timeout(10000),
      })
      const body = await response.text()
      assert(response.status === 200 && /^text\/plain\b/i.test(response.headers.get('content-type') ?? '') && body === indexNowKey,
        `IndexNow ownership file: expected HTTP 200, plain text, and an exact match on the canonical host (received HTTP ${response.status})`)
    } catch {
      assert(false, 'IndexNow ownership file: could not fetch the file from the canonical host')
    }
  } else {
    try {
      const body = readFileSync(join(root, 'dist', fileName), 'utf8')
      assert(body === indexNowKey, 'IndexNow ownership file: the build output must contain the exact verification value')
    } catch {
      assert(false, 'IndexNow ownership file: could not read the file from the build output')
    }
  }
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
