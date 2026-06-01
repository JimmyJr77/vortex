import { GYMNASTICS_ORIGIN } from '../config/gymnasticsSeo'

export { GYMNASTICS_ORIGIN }

const isLocalDevHost = (): boolean => {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

/**
 * URL for the Vortex Gymnastics site.
 * Production: https://vortex-gymnastics.com/...
 * Local dev: same path with ?sport=gymnastics (loads GymnasticsApp via main.tsx).
 */
export function getGymnasticsSiteUrl(path = '/'): string {
  const normalized = path.startsWith('/') ? path : `/${path}`

  if (import.meta.env.DEV && isLocalDevHost()) {
    if (normalized === '/') {
      return '/?sport=gymnastics'
    }
    const separator = normalized.includes('?') ? '&' : '?'
    return `${normalized}${separator}sport=gymnastics`
  }

  if (normalized === '/') {
    return `${GYMNASTICS_ORIGIN}/`
  }
  return `${GYMNASTICS_ORIGIN}${normalized}`
}
