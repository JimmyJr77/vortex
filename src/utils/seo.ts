/** Canonical hub origin. Production redirects the www host to this apex host. */
export const HUB_ORIGIN = 'https://vortexathletics.com'
export const SITE_NAME = 'Vortex Athletics'
/** Header wordmark on vortexathletics.com and sport stub sites (not gymnastics). */
export const HUB_HEADER_LOGO = '/vortex-athletics-logo.webp'
export const DEFAULT_OG_IMAGE = `${HUB_ORIGIN}/vortex-athletics-og.jpg`

export interface SeoMeta {
  title: string
  description: string
  canonical: string
  siteName?: string
  ogImage?: string
  ogImageAlt?: string
  robots?: string
}

export const buildCanonical = (origin: string, path = '/'): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (normalizedPath === '/') {
    return origin.endsWith('/') ? origin.slice(0, -1) || origin : origin
  }
  const base = origin.endsWith('/') ? origin.slice(0, -1) : origin
  return `${base}${normalizedPath}`
}

export const buildStubCanonical = (canonicalHost: string): string =>
  `https://${canonicalHost}/`
