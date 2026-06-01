import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import GymnasticsApp from './apps/gymnastics/GymnasticsApp.tsx'
import ComingSoon from './components/stub/ComingSoon.tsx'
import {
  isStubPreviewOnNonStubHost,
  resolveStubSite,
} from './config/stubSites.ts'

// Inject CDN preconnect link for performance
const cdnBaseUrl = import.meta.env.VITE_CDN_BASE_URL
if (cdnBaseUrl) {
  try {
    const cdnUrl = new URL(cdnBaseUrl)
    const cdnOrigin = `${cdnUrl.protocol}//${cdnUrl.host}`
    
    // Check if preconnect link already exists
    const existingLink = document.querySelector(`link[rel="preconnect"][href="${cdnOrigin}"]`)
    if (!existingLink) {
      // Add preconnect link
      const preconnectLink = document.createElement('link')
      preconnectLink.rel = 'preconnect'
      preconnectLink.href = cdnOrigin
      preconnectLink.crossOrigin = 'anonymous'
      document.head.appendChild(preconnectLink)
      
      // Also add dns-prefetch as fallback
      const dnsPrefetchLink = document.createElement('link')
      dnsPrefetchLink.rel = 'dns-prefetch'
      dnsPrefetchLink.href = cdnOrigin
      document.head.appendChild(dnsPrefetchLink)
    }
  } catch (error) {
    console.warn('Failed to parse CDN URL for preconnect:', error)
  }
}

// If the current domain is one of the vortex-<sport>.com stub sites, render the
// lightweight "League Coming Soon" stub instead of the full Vortex Athletics app.
const stubSite = resolveStubSite(window.location.hostname, window.location.search)
const stubPreview = stubSite
  ? isStubPreviewOnNonStubHost(window.location.hostname, window.location.search)
  : false

if (stubSite?.key === 'gymnastics') {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HelmetProvider>
        <BrowserRouter>
          <GymnasticsApp isPreview={stubPreview} />
        </BrowserRouter>
      </HelmetProvider>
    </StrictMode>,
  )
} else if (stubSite) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HelmetProvider>
        <ComingSoon config={stubSite} isPreview={stubPreview} />
      </HelmetProvider>
    </StrictMode>,
  )
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HelmetProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HelmetProvider>
    </StrictMode>,
  )
}
