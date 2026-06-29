import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const RELOAD_FLAG = 'vortex:chunk-reload'

function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error)
}

/** True when a dynamic import failed because a hashed JS chunk is missing (usually after deploy). */
export function isChunkLoadError(error: unknown): boolean {
  const message = messageFromError(error).toLowerCase()
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('dynamically imported module') ||
    message.includes('loading chunk') ||
    message.includes('load failed') ||
    message.includes('mime type')
  )
}

/**
 * Reload once to pick up a new frontend deploy. Returns false if we already reloaded
 * for this failure chain so callers can show a manual refresh prompt.
 */
export function reloadForStaleChunks(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.removeItem(RELOAD_FLAG)
      return false
    }
    sessionStorage.setItem(RELOAD_FLAG, '1')
  } catch {
    // sessionStorage unavailable — still attempt reload
  }
  window.location.reload()
  return true
}

/** Call after a successful boot so the next deploy can trigger another auto-reload. */
export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG)
  } catch {
    // ignore
  }
}

/** Drop-in replacement for React.lazy that reloads once when a stale chunk 404s. */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((error: unknown) => {
      if (isChunkLoadError(error)) {
        reloadForStaleChunks()
        return new Promise<{ default: T }>(() => {})
      }
      throw error
    }),
  )
}

/** Global listeners for chunk failures outside React.lazy (nested splits, Vite preload). */
export function initChunkLoadRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    reloadForStaleChunks()
  })

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      event.preventDefault()
      reloadForStaleChunks()
    }
  })
}
