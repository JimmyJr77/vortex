import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
