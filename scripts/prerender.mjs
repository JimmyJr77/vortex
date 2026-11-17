/**
 * Optional post-build prerender (set PRERENDER=true).
 * - Hub routes: Playwright snapshots into dist/<path>/index.html
 * - Stub domains: host-specific HTML with injected meta in dist/_seo/
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_OG_IMAGE,
  HUB_ARTICLE_PATHS,
  HUB_GUIDE_INDEX_PATH,
  HUB_PRERENDER_PATHS,
  HUB_PROGRAM_PATHS,
  SITE_NAME,
  SPA_SHELL_PATH,
  STUB_SEO_ENTRIES,
} from './seo-config.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const distDir = join(rootDir, 'dist')
// These public pages use Inter for both headings and body text.
const interOnlyContentPaths = new Set([...HUB_PROGRAM_PATHS, HUB_GUIDE_INDEX_PATH, ...HUB_ARTICLE_PATHS])
let previewPort = 0
let previewOrigin = ''

const findAvailablePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not allocate a local prerender port'))
        return
      }
      const port = address.port
      server.close((err) => (err ? reject(err) : resolve(port)))
    })
  })

const escapeAttr = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')

const buildSeoHeadBlock = ({
  title,
  description,
  canonical,
  siteName = SITE_NAME,
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
    <meta property="og:site_name" content="${escapeAttr(siteName)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${escapeAttr(ogImage)}" />
    <meta name="twitter:image:alt" content="${escapeAttr(ogImageAlt)}" />
`
}

const injectSeoIntoHtml = (html, seo) => {
  let output = html.replace(/<title>.*?<\/title>/i, `<title>${escapeAttr(seo.title)}</title>`)
  output = output.replace(
    /<meta\s+name="description"[^>]*>/i,
    '',
  )
  const block = buildSeoHeadBlock(seo)
  return output.replace('</head>', `${block}  </head>`)
}

const generateShellHtml = () => {
  const indexPath = join(distDir, 'index.html')
  if (!existsSync(indexPath)) {
    throw new Error('dist/index.html not found. Run vite build first.')
  }

  const baseHtml = readFileSync(indexPath, 'utf8')
  const seoDir = join(distDir, '_seo')
  mkdirSync(seoDir, { recursive: true })

  // Account and other client-only routes need the app entry point without
  // inheriting the prerendered homepage's content, canonical, and metadata.
  const spaHtml = baseHtml
    .replace(/<title>.*?<\/title>/i, '<title>Vortex Athletics</title>')
    .replace(/<meta\s+name="description"[^>]*>/i, '')
    .replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>')
  writeFileSync(join(distDir, SPA_SHELL_PATH), spaHtml, 'utf8')

  for (const stub of STUB_SEO_ENTRIES) {
    const html = injectSeoIntoHtml(baseHtml, {
      title: stub.title,
      description: stub.description,
      canonical: stub.canonical,
      robots: stub.robots,
    })
    const outPath = join(seoDir, `${stub.host}.html`)
    writeFileSync(outPath, html, 'utf8')
    console.log(`[prerender] Wrote ${outPath}`)
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
  out = keepLastMatch(out, /<link\s+rel=["']canonical["'][^>]*>/gi)
  out = keepLastMatch(out, /<meta\s+name=["']robots["'][^>]*>/gi)
  for (const property of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'og:type', 'og:locale', 'og:site_name']) {
    out = keepLastMatch(out, new RegExp(`<meta\\s+property=["']${property}["'][^>]*>`, 'gi'))
  }
  for (const name of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']) {
    out = keepLastMatch(out, new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, 'gi'))
  }
  return out
}

const prerenderAppRoutes = async () => {
  previewPort = await findAvailablePort()
  previewOrigin = `http://127.0.0.1:${previewPort}`

  let chromium
  let launchOptions = {}
  try {
    const playwright = await import('playwright')
    chromium = playwright.chromium
  } catch (error) {
    if (process.env.VERCEL || process.env.PRERENDER_STRICT === 'true') throw error
    console.warn(
      '[prerender] Playwright not installed; skipping route prerender. Run: npm i -D playwright',
    )
    return
  }

  if (process.env.VERCEL) {
    const serverlessChromium = (await import('@sparticuz/chromium')).default
    // @sparticuz/chromium includes Lambda-oriented single-process flags. In
    // Vercel's build container they can cause Chromium to exit immediately
    // after launch, before Playwright can create its first page.
    const vercelChromiumArgs = serverlessChromium.args.filter(
      (arg) => arg !== '--single-process' && arg !== '--in-process-gpu',
    )
    launchOptions = {
      args: vercelChromiumArgs,
      executablePath: await serverlessChromium.executablePath(),
      headless: true,
    }
    console.log('[prerender] Using serverless Chromium for Vercel')
  }

  const preview = spawn(
    process.execPath,
    [join(rootDir, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'],
    { cwd: rootDir, stdio: 'inherit' },
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
        omitDisplayFontPreload: interOnlyContentPaths.has(routePath),
        outFile:
          routePath === '/'
            ? join(distDir, 'index.html')
            : join(distDir, routePath.replace(/^\//, ''), 'index.html'),
      })),
    ]

    const browser = await chromium.launch(launchOptions)
    const snapshots = []
    const failures = []
    for (const target of targets) {
      let lastError
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const page = await browser.newPage({ reducedMotion: 'reduce' })
        try {
          await page.route((url) => url.origin !== previewOrigin || url.pathname.startsWith('/api/'), (route) => route.abort())
          await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
          await page.waitForFunction(
            () => Boolean(
              document.querySelector('#root h1') &&
              document.head.querySelector('link[rel="canonical"]') &&
              document.head.querySelector('meta[property="og:title"]')
            ),
            undefined,
            { timeout: 30000 },
          )
          // Static HTML must be independent of live catalogs, schedules and
          // account state. Keep the poster and defer every video URL to React.
          const snapshot = await page.evaluate((omitDisplayFontPreload) => {
            const html = document.documentElement.cloneNode(true)
            html.querySelectorAll('[data-prerender-dynamic]').forEach((node) => node.remove())
            html.querySelectorAll('video[src], video source[src]').forEach((node) => node.removeAttribute('src'))
            if (omitDisplayFontPreload) {
              html.querySelector('link[rel="preload"][href="/fonts/oswald-latin-variable.woff2"]')?.remove()
            }
            return { html: `<!doctype html>\n${html.outerHTML}`, title: document.title }
          }, target.omitDisplayFontPreload)
          const html = dedupeHeadTags(snapshot.html, snapshot.title)
          snapshots.push({ outFile: target.outFile, html })
          lastError = null
          break
        } catch (err) {
          lastError = err
          if (attempt === 1) console.warn(`[prerender] Retrying ${target.url} in a fresh page`)
        } finally {
          await page.close().catch(() => {})
        }
      }
      if (lastError) {
        failures.push(`${target.url}: ${lastError?.message ?? lastError}`)
      }
    }

    await browser.close()

    for (const { outFile, html } of snapshots) {
      mkdirSync(dirname(outFile), { recursive: true })
      writeFileSync(outFile, html, 'utf8')
      console.log(`[prerender] Wrote ${outFile}`)
    }

    if (failures.length > 0) {
      throw new Error(
        `Failed to prerender ${failures.length}/${targets.length} routes:\n${failures.join('\n')}`,
      )
    }
  } catch (err) {
    // Production depends on these snapshots for route-specific SEO. Do not
    // silently deploy generic SPA HTML when Vercel prerendering regresses.
    if (process.env.VERCEL || process.env.PRERENDER_STRICT === 'true') throw err

    // Keep local builds usable when a developer has not installed Chromium.
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

  const indexNowKey = process.env.VERCEL_ENV === 'production' ? process.env.INDEXNOW_KEY : undefined
  if (indexNowKey && !/^[a-z0-9-]{8,128}$/i.test(indexNowKey)) {
    throw new Error('Invalid IndexNow verification key')
  }

  generateShellHtml()
  await prerenderAppRoutes()
  if (indexNowKey) writeFileSync(join(distDir, `${indexNowKey}.txt`), indexNowKey, 'utf8')
  console.log('[prerender] Done')
}

main().catch((err) => {
  console.error('[prerender] Failed:', err)
  process.exit(1)
})
