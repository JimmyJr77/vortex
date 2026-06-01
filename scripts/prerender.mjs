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

const buildSeoHeadBlock = ({ title, description, canonical, robots }) => {
  const robotsTag = robots
    ? `    <meta name="robots" content="${escapeAttr(robots)}" />\n`
    : ''
  return `
    <meta name="description" content="${escapeAttr(description)}" />
    <link rel="canonical" href="${escapeAttr(canonical)}" />
${robotsTag}    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:url" content="${escapeAttr(canonical)}" />
    <meta property="og:image" content="${escapeAttr(DEFAULT_OG_IMAGE)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeAttr(SITE_NAME)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${escapeAttr(DEFAULT_OG_IMAGE)}" />
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

const prerenderHubRoutes = async () => {
  let chromium
  try {
    const playwright = await import('playwright')
    chromium = playwright.chromium
  } catch {
    console.warn(
      '[prerender] Playwright not installed; skipping hub route prerender. Run: npm i -D playwright',
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

    const browser = await chromium.launch()
    const page = await browser.newPage()

    for (const routePath of HUB_PRERENDER_PATHS) {
      const url = `${previewOrigin}${routePath}`
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
      await page.waitForSelector('#root', { timeout: 30000 })

      const html = await page.content()
      const outDir =
        routePath === '/'
          ? distDir
          : join(distDir, routePath.replace(/^\//, ''))
      mkdirSync(outDir, { recursive: true })
      const outFile = join(outDir, 'index.html')
      writeFileSync(outFile, html, 'utf8')
      console.log(`[prerender] Wrote ${outFile}`)
    }

    await browser.close()
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
  await prerenderHubRoutes()
  console.log('[prerender] Done')
}

main().catch((err) => {
  console.error('[prerender] Failed:', err)
  process.exit(1)
})
