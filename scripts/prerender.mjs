/**
 * Optional post-build prerender (set PRERENDER=true).
 * - Hub routes: Playwright snapshots into dist/<path>/index.html
 * - Stub domains: host-specific HTML with injected meta in dist/_seo/
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_OG_IMAGE,
  GYMNASTICS_HOST_PAGES,
  GYMNASTICS_PRERENDER_PATHS,
  HUB_PRERENDER_PATHS,
  SITE_NAME,
  STUB_SEO_ENTRIES,
} from './seo-config.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const distDir = join(rootDir, 'dist')
const previewPort = 4173
const previewOrigin = `http://127.0.0.1:${previewPort}`

const escapeAttr = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')

const buildSeoHeadBlock = ({
  title,
  description,
  canonical,
  robots,
  ogImage = DEFAULT_OG_IMAGE,
  ogImageAlt = SITE_NAME,
}) => {
  const robotsTag = robots
    ? `    <meta name="robots" content="${escapeAttr(robots)}" />\n`
    : ''
  return `
    <meta name="description" content="${escapeAttr(description)}" />
    <link rel="canonical" href="${escapeAttr(canonical)}" />
${robotsTag}    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:url" content="${escapeAttr(canonical)}" />
    <meta property="og:image" content="${escapeAttr(ogImage)}" />
    <meta property="og:image:alt" content="${escapeAttr(ogImageAlt)}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:site_name" content="${escapeAttr(SITE_NAME)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${escapeAttr(ogImage)}" />
    <meta name="twitter:image:alt" content="${escapeAttr(ogImageAlt)}" />
`
}

/**
 * Remove any `noindex`/`nofollow` robots meta from a prerendered snapshot.
 * Gymnastics pages are rendered via the `?sport=gymnastics` preview override,
 * which the app treats as a preview (noindex). On the real domain the client
 * renders them as indexable, so the static snapshot must not ship noindex.
 */
const stripNoindexRobots = (html) =>
  html.replace(
    /<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*["'][^>]*>\s*/gi,
    '',
  )

const injectSeoIntoHtml = (html, seo) => {
  let output = html.replace(/<title>.*?<\/title>/i, `<title>${escapeAttr(seo.title)}</title>`)
  output = output.replace(
    /<meta\s+name="description"[^>]*>/i,
    '',
  )
  const block = buildSeoHeadBlock(seo)
  return output.replace('</head>', `${block}  </head>`)
}

const generateStubHostHtml = () => {
  const indexPath = join(distDir, 'index.html')
  if (!existsSync(indexPath)) {
    console.warn('[prerender] dist/index.html not found, skipping stub SEO HTML')
    return
  }

  const baseHtml = readFileSync(indexPath, 'utf8')
  const seoDir = join(distDir, '_seo')
  mkdirSync(seoDir, { recursive: true })

  const comingSoonStubs = STUB_SEO_ENTRIES.filter(
    (stub) => stub.host !== 'vortex-gymnastics.com',
  )

  for (const stub of comingSoonStubs) {
    const html = injectSeoIntoHtml(baseHtml, {
      title: stub.title,
      description: stub.description,
      canonical: stub.canonical,
    })
    const outPath = join(seoDir, `${stub.host}.html`)
    writeFileSync(outPath, html, 'utf8')
    console.log(`[prerender] Wrote ${outPath}`)
  }
}

/**
 * Write baseline _gym/*.html files (gymnastics homepage + read-board) using
 * string injection, WITHOUT Chromium. The vercel.json host rules for
 * vortex-gymnastics.com point at these files, so they must always exist even if
 * the Chromium snapshot step is unavailable (e.g. browser install failed on the
 * build host). The Chromium pass overwrites them with full-content snapshots.
 */
const generateGymHostBaseline = () => {
  const indexPath = join(distDir, 'index.html')
  if (!existsSync(indexPath)) {
    console.warn('[prerender] dist/index.html not found, skipping _gym baseline')
    return
  }

  const baseHtml = readFileSync(indexPath, 'utf8')
  for (const page of GYMNASTICS_HOST_PAGES) {
    const html = injectSeoIntoHtml(baseHtml, {
      title: page.title,
      description: page.description,
      canonical: page.canonical,
      ogImage: page.ogImage,
      ogImageAlt: page.ogImageAlt,
    })
    const outPath = join(distDir, page.outFile)
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, html, 'utf8')
    console.log(`[prerender] Wrote baseline ${outPath}`)
  }
}

const waitForServer = (port, timeoutMs = 60000) =>
  new Promise((resolve, reject) => {
    const start = Date.now()
    const check = async () => {
      try {
        const res = await fetch(`${previewOrigin}/`)
        if (res.ok) {
          resolve()
          return
        }
      } catch {
        // retry
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Preview server did not start on port ${port}`))
        return
      }
      setTimeout(check, 500)
    }
    check()
  })

/** Remove all but the LAST match of `regex` (uses match indices, not identity). */
const keepLastMatch = (html, regex) => {
  const matches = [...html.matchAll(regex)]
  if (matches.length <= 1) return html
  let result = ''
  let cursor = 0
  for (let i = 0; i < matches.length - 1; i++) {
    const m = matches[i]
    result += html.slice(cursor, m.index)
    cursor = m.index + m[0].length
  }
  return result + html.slice(cursor)
}

/**
 * The source index.html ships a static <title> and <meta name="description">.
 * After React + react-helmet hydrate, the route-specific tags are also present.
 * Replace all <title> tags with the authoritative document.title, and keep only
 * the last <meta name="description"> (react-helmet appends its meta last).
 */
const dedupeHeadTags = (html, pageTitle) => {
  let out = html.replace(/<title>[\s\S]*?<\/title>/gi, '')
  out = out.replace(/<head>/i, `<head><title>${escapeAttr(pageTitle)}</title>`)
  out = keepLastMatch(out, /<meta\s+name=["']description["'][^>]*>/gi)
  return out
}

const prerenderAppRoutes = async () => {
  let chromium
  try {
    const playwright = await import('playwright')
    chromium = playwright.chromium
  } catch {
    console.warn(
      '[prerender] Playwright not installed; skipping route prerender. Run: npm i -D playwright',
    )
    return
  }

  const preview = spawn(
    'npx',
    ['vite', 'preview', '--port', String(previewPort), '--strictPort'],
    { cwd: rootDir, stdio: 'inherit', shell: true },
  )

  try {
    await waitForServer(previewPort)

    // The SPA serves index.html for every route, so we must capture all
    // snapshots BEFORE writing any (otherwise later routes would inherit an
    // earlier route's injected <head>).
    const targets = [
      // Hub routes (vortexathletics.com) render on the default host.
      ...HUB_PRERENDER_PATHS.map((routePath) => ({
        url: `${previewOrigin}${routePath}`,
        outFile:
          routePath === '/'
            ? join(distDir, 'index.html')
            : join(distDir, routePath.replace(/^\//, ''), 'index.html'),
        stripNoindex: false,
      })),
      // Gymnastics routes (vortex-gymnastics.com) render via the ?sport override.
      // These paths do not collide with hub paths, so they get their own dir.
      ...GYMNASTICS_PRERENDER_PATHS.map((routePath) => ({
        url: `${previewOrigin}${routePath}?sport=gymnastics`,
        outFile: join(distDir, routePath.replace(/^\//, ''), 'index.html'),
        stripNoindex: true,
      })),
      // Gymnastics routes whose paths collide with the hub (/, /read-board):
      // snapshot into dedicated _gym/* files served via host rules.
      ...GYMNASTICS_HOST_PAGES.map((page) => ({
        url: `${previewOrigin}${page.path}?sport=gymnastics`,
        outFile: join(distDir, page.outFile),
        stripNoindex: true,
      })),
    ]

    const browser = await chromium.launch()
    const page = await browser.newPage()

    const snapshots = []
    for (const target of targets) {
      await page.goto(target.url, { waitUntil: 'networkidle', timeout: 60000 })
      await page.waitForSelector('#root', { timeout: 30000 })
      const pageTitle = await page.title()
      let html = dedupeHeadTags(await page.content(), pageTitle)
      if (target.stripNoindex) html = stripNoindexRobots(html)
      snapshots.push({ outFile: target.outFile, html })
    }

    await browser.close()

    for (const { outFile, html } of snapshots) {
      mkdirSync(dirname(outFile), { recursive: true })
      writeFileSync(outFile, html, 'utf8')
      console.log(`[prerender] Wrote ${outFile}`)
    }
  } catch (err) {
    // Never fail the build because of prerendering; fall back to the SPA.
    console.warn('[prerender] Route prerender failed, continuing build:', err?.message ?? err)
  } finally {
    preview.kill('SIGTERM')
  }
}

const main = async () => {
  if (process.env.PRERENDER !== 'true') {
    console.log('[prerender] Skipped (set PRERENDER=true to enable)')
    return
  }

  if (!existsSync(distDir)) {
    console.error('[prerender] dist/ not found. Run vite build first.')
    process.exit(1)
  }

  generateStubHostHtml()
  generateGymHostBaseline()
  await prerenderAppRoutes()
  console.log('[prerender] Done')
}

main().catch((err) => {
  console.error('[prerender] Failed:', err)
  process.exit(1)
})
