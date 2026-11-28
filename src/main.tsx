import { StrictMode, Suspense, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { loadHomePage, loadPublicProgramPage, publicGuideLoaders, publicPageLoaders, type PublicSnapshotPage } from './config/publicPageLoaders'
import publicLandingRedirects from './config/publicLandingRedirects.json'
import { HUB_ORIGIN } from './utils/seo'
import {
  isStubPreviewOnNonStubHost,
  resolveStubSite,
} from './config/stubSites.ts'
import {
  initGoogleAnalyticsConsent,
  initGoogleAnalyticsLinker,
} from './utils/googleAnalytics.ts'
import { updateGoogleConsent } from './utils/googleAnalytics.ts'
import { captureConsentIdFromUrl } from './utils/crossDomainConsent.ts'
import { getStoredConsent, initCrossDomainConsent } from './utils/consent.ts'
import { ChunkLoadErrorBoundary } from './components/ChunkLoadErrorBoundary.tsx'
import { hasAdminSession } from './utils/api.ts'
import { clearChunkReloadFlag, initChunkLoadRecovery, isChunkLoadError, lazyWithRetry, reloadForStaleChunks } from './utils/chunkLoadRecovery.ts'
import { getMemberSessionToken } from './utils/portalSession.ts'

const CookieConsent = lazyWithRetry(() => import('./components/CookieConsent.tsx'))
const PublicSiteAnalytics = lazyWithRetry(() => import('./components/analytics/PublicSiteAnalytics.tsx'))
const SchedulingPage = lazyWithRetry(publicPageLoaders.enroll.load)
const ComingSoon = lazyWithRetry(() => import('./components/stub/ComingSoon.tsx'))
const App = lazyWithRetry(() => import('./App.tsx'))

const appLoader = <div className="min-h-screen bg-white" aria-busy="true" />
const root = document.getElementById('root')!

// Alternate hosts and existing sessions keep their normal startup path.
const stubSite = resolveStubSite(window.location.hostname, window.location.search)
const stubPreview = stubSite
  ? isStubPreviewOnNonStubHost(window.location.hostname, window.location.search)
  : false
const isLegacyGymnasticsHost = /^(www\.)?vortex-gymnastics\.com$/i.test(window.location.hostname)
const snapshotPath = root.dataset.prerenderedPage ?? root.dataset.prerenderedProgram
const currentPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/'
const keepPublicSnapshot = snapshotPath === currentPath &&
  !stubSite && !isLegacyGymnasticsHost && !hasAdminSession() && !getMemberSessionToken()

/**
 * Production route snapshots contain a complete SEO head for non-JavaScript
 * crawlers. This app mounts with createRoot rather than hydrateRoot; in React
 * 19, document metadata is hoisted into <head>, so leaving the snapshot tags in
 * place would create a second title/canonical/meta set after mount. Remove only
 * the route-owned search/share tags immediately before React recreates them.
 */
const clearPrerenderedSeoHead = () => {
  const selectors = [
    'head > title',
    'head > meta[name="description"]',
    'head > meta[name="robots"]',
    'head > meta[property^="og:"]',
    'head > meta[name^="twitter:"]',
    'head > link[rel="canonical"]',
    'head > link[rel="preload"][as="image"]',
    'head > script[type="application/ld+json"]',
  ]
  document.querySelectorAll(selectors.join(',')).forEach((node) => node.remove())
}

function prepareReactMount() {
  clearPrerenderedSeoHead()
  initChunkLoadRecovery()
  clearChunkReloadFlag()
}

function renderWebsite(app: ReactNode) {
  createRoot(root).render(
    <StrictMode>
      <ChunkLoadErrorBoundary>
        <HelmetProvider>
          <Suspense fallback={appLoader}>
            <BrowserRouter>{app}</BrowserRouter>
          </Suspense>
        </HelmetProvider>
      </ChunkLoadErrorBoundary>
    </StrictMode>,
  )
}

async function loadSnapshotPage(path: string): Promise<PublicSnapshotPage> {
  if (path === '/') return { kind: 'home', Component: (await loadHomePage()).default }
  if (path === root.dataset.prerenderedProgram) {
    return { kind: 'program', path, Component: (await loadPublicProgramPage()).default }
  }
  const page = Object.values(publicPageLoaders).find((page) => page.path === path)
  if (page) return page.snapshot()
  const guide = publicGuideLoaders.find((guide) => guide.path === path)
  if (!guide) throw new Error(`No page loader for snapshot path ${path}`)
  return { kind: 'guide', path, Component: (await guide.load()).default }
}

async function mountPublicSnapshot(path: string) {
  try {
    // Render the resolved components so React can replace the snapshot in one commit.
    const [{ default: Website }, snapshotPage] = await Promise.all([import('./App.tsx'), loadSnapshotPage(path)])
    flushSync(() => {
      prepareReactMount()
      renderWebsite(<Website snapshotPage={snapshotPage} />)
    })
  } catch (error) {
    // Keep the readable snapshot while the existing one-reload recovery runs.
    if (isChunkLoadError(error)) reloadForStaleChunks()
    else console.error('Could not start the public page', error)
  }
}

if (!keepPublicSnapshot) prepareReactMount()

initGoogleAnalyticsConsent()
initGoogleAnalyticsLinker()
captureConsentIdFromUrl()
const storedConsent = getStoredConsent()
if (storedConsent) {
  updateGoogleConsent(storedConsent.analytics, storedConsent.marketing)
}
void initCrossDomainConsent()

// Optional CDN hint: dns-prefetch only (preconnect errors when the CDN host is not set up yet).
const cdnBaseUrl = import.meta.env.VITE_CDN_BASE_URL
const cdnPreconnect = import.meta.env.VITE_CDN_PRECONNECT === 'true'
if (cdnBaseUrl && import.meta.env.PROD) {
  try {
    const cdnUrl = new URL(cdnBaseUrl)
    const cdnOrigin = `${cdnUrl.protocol}//${cdnUrl.host}`

    if (cdnPreconnect) {
      const existingPreconnect = document.querySelector(`link[rel="preconnect"][href="${cdnOrigin}"]`)
      if (!existingPreconnect) {
        const preconnectLink = document.createElement('link')
        preconnectLink.rel = 'preconnect'
        preconnectLink.href = cdnOrigin
        preconnectLink.crossOrigin = 'anonymous'
        document.head.appendChild(preconnectLink)
      }
    } else {
      const existingPrefetch = document.querySelector(`link[rel="dns-prefetch"][href="${cdnOrigin}"]`)
      if (!existingPrefetch) {
        const dnsPrefetchLink = document.createElement('link')
        dnsPrefetchLink.rel = 'dns-prefetch'
        dnsPrefetchLink.href = cdnOrigin
        document.head.appendChild(dnsPrefetchLink)
      }
    }
  } catch (error) {
    console.warn('Failed to parse CDN URL for prefetch:', error)
  }
}

// Vercel handles this before serving HTML. Keep the same canonical redirect
// for alternate/static hosting so this domain never renders a separate app.
if (isLegacyGymnasticsHost) {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  const destination = (publicLandingRedirects as Record<string, string>)[path] || path
  const target = new URL(destination, HUB_ORIGIN)
  target.search = window.location.search
  if (!target.hash) target.hash = window.location.hash
  window.location.replace(target.href)
} else if (stubSite && stubSite.key !== 'gymnastics') {
  createRoot(root).render(
    <StrictMode>
      <ChunkLoadErrorBoundary>
        <HelmetProvider>
          <BrowserRouter>
            <Suspense fallback={appLoader}>
              <Routes>
                <Route path="/enroll" element={<><PublicSiteAnalytics disabled={stubPreview} /><SchedulingPage />{!stubPreview && <CookieConsent />}</>} />
                <Route path="/scheduling" element={<Navigate to="/enroll" replace />} />
                <Route path="/schedule" element={<Navigate to="/enroll" replace />} />
                <Route path="*" element={<ComingSoon config={stubSite} isPreview={stubPreview} />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </HelmetProvider>
      </ChunkLoadErrorBoundary>
    </StrictMode>,
  )
} else if (keepPublicSnapshot) {
  void mountPublicSnapshot(currentPath)
} else {
  renderWebsite(<App />)
}
