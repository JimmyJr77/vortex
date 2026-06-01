import { buildCanonical, type SeoMeta } from '../utils/seo'

export const GYMNASTICS_ORIGIN = 'https://vortex-gymnastics.com'

/** Header wordmark on vortex-gymnastics.com (wide banner). */
export const GYMNASTICS_HEADER_LOGO = '/vortex_gymnastics_logo.png'

/** Per-origin Open Graph image so gymnastics shares use gymnastics branding. */
export const GYMNASTICS_OG_IMAGE = `${GYMNASTICS_ORIGIN}/vortex_gymnastics_logo.png`

export interface GymnasticsRouteSeo {
  path: string
  title: string
  description: string
  /** When set, the canonical points here instead of `path` (de-duplication). */
  canonicalPath?: string
  /** Default robots for this route (preview override still takes precedence). */
  robots?: string
}

export const GYMNASTICS_ROUTES: GymnasticsRouteSeo[] = [
  {
    path: '/',
    title: 'Gymnastics Classes in Bowie, MD | Vortex Gymnastics',
    description:
      'Gymnastics classes for all ages in Bowie, MD - preschool to competitive, taught by expert coaches. Book a free trial class today.',
  },
  {
    // Near-duplicate of `/` (same component): canonicalize to the home hub.
    path: '/gymnastics',
    title: 'Gymnastics Programs in Bowie, MD | Vortex Gymnastics',
    description:
      'Explore gymnastics programs in Bowie, MD for every age and level, from preschool to competitive. Book a free trial class today.',
    canonicalPath: '/',
  },
  {
    path: '/artistic-gymnastics-early',
    title: 'Preschool Gymnastics (Ages 2-5) in Bowie, MD',
    description:
      'Preschool and toddler gymnastics in Bowie, MD for ages 2-5. Build coordination and confidence through play. Book a free trial class.',
  },
  {
    path: '/artistic-gymnastics-6-12',
    title: 'Kids Gymnastics Classes (Ages 6-12) | Bowie, MD',
    description:
      'Gymnastics classes for kids ages 6-12 in Bowie, MD. Beginner to advanced, with safe technique and progression. Book a trial class.',
  },
  {
    path: '/artistic-gymnastics-13-18',
    title: 'Teen & Competitive Gymnastics (13-18) | Bowie MD',
    description:
      'Advanced and competitive gymnastics for ages 13-18 in Bowie, MD. Strength, skills, and performance readiness. Request team info.',
  },
  {
    // Paid-campaign landing pages duplicate the evergreen program pages.
    path: '/campaigns/artistic-gymnastics-early',
    title: 'Preschool Gymnastics (Ages 2-5) in Bowie, MD',
    description:
      'Preschool and toddler gymnastics in Bowie, MD for ages 2-5. Build coordination and confidence through play. Book a free trial class.',
    canonicalPath: '/artistic-gymnastics-early',
    robots: 'noindex, follow',
  },
  {
    path: '/campaigns/artistic-gymnastics-6-12',
    title: 'Kids Gymnastics Classes (Ages 6-12) | Bowie, MD',
    description:
      'Gymnastics classes for kids ages 6-12 in Bowie, MD. Beginner to advanced, with safe technique and progression. Book a trial class.',
    canonicalPath: '/artistic-gymnastics-6-12',
    robots: 'noindex, follow',
  },
  {
    path: '/campaigns/artistic-gymnastics-13-18',
    title: 'Teen & Competitive Gymnastics (13-18) | Bowie MD',
    description:
      'Advanced and competitive gymnastics for ages 13-18 in Bowie, MD. Strength, skills, and performance readiness. Request team info.',
    canonicalPath: '/artistic-gymnastics-13-18',
    robots: 'noindex, follow',
  },
  {
    path: '/read-board',
    title: 'Gymnastics Classes, Camps & Events | Bowie, MD',
    description:
      'Upcoming gymnastics classes, camps, and open gyms at Vortex Gymnastics in Bowie, MD. Register your athlete today.',
  },
]

const routeMap = new Map(GYMNASTICS_ROUTES.map((route) => [route.path, route]))

export const getGymnasticsSeoForPath = (
  pathname: string,
  options?: { robots?: string },
): SeoMeta => {
  const route = routeMap.get(pathname) ?? GYMNASTICS_ROUTES[0]
  return {
    title: route.title,
    description: route.description,
    canonical: buildCanonical(GYMNASTICS_ORIGIN, route.canonicalPath ?? route.path),
    ogImage: GYMNASTICS_OG_IMAGE,
    ogImageAlt: 'Vortex Gymnastics',
    // Preview override (noindex) wins; otherwise use the route's own robots.
    robots: options?.robots ?? route.robots,
  }
}
