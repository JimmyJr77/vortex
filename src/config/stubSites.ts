import { buildStubCanonical, type SeoMeta } from '../utils/seo'

export interface StubSiteConfig {
  key: string
  sportLabel: string
  headline: string
  canonicalHost: string
  description: string
  ogImage?: string
}

const MAIN_SITE_URL = 'https://www.vortexathletics.com'

export const HUB_URL = MAIN_SITE_URL

export const STUB_SITES: Record<string, StubSiteConfig> = {
  'vortex-gymnastics.com': {
    key: 'gymnastics',
    sportLabel: 'Gymnastics',
    headline: 'Vortex Gymnastics',
    canonicalHost: 'vortex-gymnastics.com',
    description:
      'Vortex Gymnastics offers progressive training for all ages. Programs, classes, events, and development-first coaching at Vortex Athletics.',
  },
  'vortex-lacross.com': {
    key: 'lacrosse',
    sportLabel: 'Lacrosse',
    headline: 'The Vortex Lacrosse League Is Coming Soon',
    canonicalHost: 'vortex-lacross.com',
    description:
      'Vortex Lacrosse is coming soon. Development-focused training, top coaches, and resources that help athletes grow when championships matter most.',
  },
  'vortex-conditioning.com': {
    key: 'conditioning',
    sportLabel: 'Conditioning',
    headline: 'Vortex Conditioning Is Coming Soon',
    canonicalHost: 'vortex-conditioning.com',
    description:
      'Vortex Conditioning is coming soon. Build fitness and athleticism with level-appropriate programs, expert coaching, and training resources that teach.',
  },
  'vortex-football.com': {
    key: 'football',
    sportLabel: 'Football',
    headline: 'The Vortex Football League Is Coming Soon',
    canonicalHost: 'vortex-football.com',
    description:
      'Vortex Football is coming soon. Development-first football training with expert coaches, video resources, and facilities built for athletic excellence.',
  },
  'vortex-basketball.com': {
    key: 'basketball',
    sportLabel: 'Basketball',
    headline: 'The Vortex Basketball League Is Coming Soon',
    canonicalHost: 'vortex-basketball.com',
    description:
      'Vortex Basketball is coming soon. Level-appropriate skill development, elite coaching, and training packages designed for long-term player growth.',
  },
  'vortex-track.com': {
    key: 'track',
    sportLabel: 'Track & Field',
    headline: 'The Vortex Track & Field League Is Coming Soon',
    canonicalHost: 'vortex-track.com',
    description:
      'Vortex Track & Field is coming soon. Development-focused training, expert coaches, and facilities built to help athletes excel when it counts.',
  },
  'vortex-fit.com': {
    key: 'fit',
    sportLabel: 'Fit',
    headline: 'Vortex Fit Is Coming Soon',
    canonicalHost: 'vortex-fit.com',
    description:
      'Vortex Fit is coming soon. Strength, conditioning, and athletic development with expert coaches and resources that support real learning.',
  },
  'vortex-athlete.com': {
    key: 'athlete',
    sportLabel: 'Athlete',
    headline: 'Vortex Athlete Development Is Coming Soon',
    canonicalHost: 'vortex-athlete.com',
    description:
      'Vortex Athlete development is coming soon. Complete athlete training with level-appropriate programs, top coaches, and facilities built to excel.',
  },
  'vortex-soccer.com': {
    key: 'soccer',
    sportLabel: 'Soccer',
    headline: 'The Vortex Soccer League Is Coming Soon',
    canonicalHost: 'vortex-soccer.com',
    description:
      'Vortex Soccer is coming soon. Development-first soccer training with expert coaches, video resources, and programs built for lasting growth.',
  },
  'vortex-reps.com': {
    key: 'reps',
    sportLabel: 'Reps',
    headline: 'Vortex Reps Is Coming Soon',
    canonicalHost: 'vortex-reps.com',
    description:
      'Vortex Reps is coming soon. Repetition-based skill development with expert coaching, training resources, and facilities built for athleticism.',
  },
}

export const STUB_HOSTS = Object.keys(STUB_SITES)

const lookupByKey = (key: string): StubSiteConfig | null => {
  const normalized = key.trim().toLowerCase()
  const match = Object.values(STUB_SITES).find((site) => site.key === normalized)
  return match ?? null
}

export const getStubHostForKey = (key: string): string | null => {
  const site = lookupByKey(key)
  return site?.canonicalHost ?? null
}

export const getStubSeo = (
  config: StubSiteConfig,
  options?: { isPreview?: boolean },
): SeoMeta => ({
  title: `Vortex ${config.sportLabel} | Coming Soon`,
  description: config.description,
  canonical: buildStubCanonical(config.canonicalHost),
  ogImage: config.ogImage,
  robots: options?.isPreview ? 'noindex, nofollow' : undefined,
})

export const isStubPreviewOnNonStubHost = (
  hostname: string,
  search: string,
): boolean => {
  if (!search) return false
  const params = new URLSearchParams(search)
  if (!params.get('sport')) return false
  const normalizedHost = hostname.trim().toLowerCase().replace(/^www\./, '')
  return !(normalizedHost in STUB_SITES)
}

/**
 * Resolve which stub site (if any) should render for the current host.
 * - Strips a leading `www.` from the hostname before matching.
 * - Supports a `?sport=soccer` query override so stubs can be previewed on
 *   localhost (which never matches a real domain).
 * Returns null when the normal Vortex Athletics app should render.
 */
export const resolveStubSite = (
  hostname: string,
  search = '',
): StubSiteConfig | null => {
  if (search) {
    const params = new URLSearchParams(search)
    const sportOverride = params.get('sport')
    if (sportOverride) {
      return lookupByKey(sportOverride)
    }
  }

  const normalizedHost = hostname.trim().toLowerCase().replace(/^www\./, '')
  return STUB_SITES[normalizedHost] ?? null
}
