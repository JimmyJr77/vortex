export const HUB_ORIGIN = 'https://www.vortexathletics.com'
export const SITE_NAME = 'Vortex Athletics'
export const DEFAULT_OG_IMAGE = `${HUB_ORIGIN}/vortex_logo_1.png`

export interface SeoMeta {
  title: string
  description: string
  canonical: string
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
