export type SpecialPagePlacement = 'nav' | 'hero'

export interface SpecialPageConfig {
  key: string
  title: string
  path: string
  canonicalSiteKey: string
  enabled: boolean
  siteKeys: string[]
  navSiteKeys: string[]
  heroSiteKeys: string[]
}

export const SPECIAL_PAGE_SITE_OPTIONS = [
  { key: 'hub', label: 'vortexathletics.com' },
  { key: 'gymnastics', label: 'vortex-gymnastics.com' },
  { key: 'basketball', label: 'vortex-basketball.com' },
  { key: 'lacrosse', label: 'vortex-lacross.com' },
  { key: 'conditioning', label: 'vortex-conditioning.com' },
  { key: 'football', label: 'vortex-football.com' },
  { key: 'track', label: 'vortex-track.com' },
  { key: 'fit', label: 'vortex-fit.com' },
  { key: 'athlete', label: 'vortex-athlete.com' },
  { key: 'soccer', label: 'vortex-soccer.com' },
  { key: 'reps', label: 'vortex-reps.com' },
] as const

export const DEFAULT_SPECIAL_PAGES: SpecialPageConfig[] = [
  {
    key: 'summer-athletic-program',
    title: 'Summer Athletic Program',
    path: '/summer-athletic-training',
    canonicalSiteKey: 'hub',
    enabled: true,
    siteKeys: ['hub'],
    navSiteKeys: ['hub'],
    heroSiteKeys: ['hub'],
  },
  {
    key: 'summer-gymnastics-program',
    title: 'Summer Gymnastics Program',
    path: '/summer-camp-26',
    canonicalSiteKey: 'gymnastics',
    enabled: true,
    siteKeys: ['hub', 'gymnastics'],
    navSiteKeys: ['hub', 'gymnastics'],
    heroSiteKeys: ['gymnastics'],
  },
]

export const isSpecialPageAvailable = (
  pages: SpecialPageConfig[],
  pageKey: string,
  siteKey: string,
) => {
  const page = pages.find((item) => item.key === pageKey)
  return Boolean(page?.enabled && page.siteKeys.includes(siteKey))
}

export const isSpecialPageEnabled = (pages: SpecialPageConfig[], pageKey: string) =>
  Boolean(pages.find((page) => page.key === pageKey)?.enabled)

export const specialPagesForPlacement = (
  pages: SpecialPageConfig[],
  siteKey: string,
  placement: SpecialPagePlacement,
) =>
  pages.filter(
    (page) =>
      page.enabled &&
      page.siteKeys.includes(siteKey) &&
      (placement === 'nav' ? page.navSiteKeys : page.heroSiteKeys).includes(siteKey),
  )
