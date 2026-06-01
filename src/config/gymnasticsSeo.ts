import { buildCanonical, type SeoMeta } from '../utils/seo'

export const GYMNASTICS_ORIGIN = 'https://vortex-gymnastics.com'

/** Header wordmark on vortex-gymnastics.com (wide banner). */
export const GYMNASTICS_HEADER_LOGO = '/vortex_gymnastics_logo.png'

export interface GymnasticsRouteSeo {
  path: string
  title: string
  description: string
}

export const GYMNASTICS_ROUTES: GymnasticsRouteSeo[] = [
  {
    path: '/',
    title: 'Vortex Gymnastics - Youth Gymnastics Programs',
    description:
      'Vortex Gymnastics offers progressive training for all ages. Artistic, rhythmic, and tumbling programs with development-first coaching at Vortex Athletics.',
  },
  {
    path: '/gymnastics',
    title: 'Gymnastics Programs | Vortex Gymnastics',
    description:
      'Progressive gymnastics training for all ages. Build strength, flexibility, discipline, and confidence through expert coaching.',
  },
  {
    path: '/artistic-gymnastics-early',
    title: 'Artistic Gymnastics Early Development | Vortex Gymnastics',
    description:
      'Early artistic gymnastics for ages 2-5. Foundational movement, confidence, and skill-building in a safe, playful environment.',
  },
  {
    path: '/artistic-gymnastics-6-12',
    title: 'Artistic Gymnastics Ages 6-12 | Vortex Gymnastics',
    description:
      'Artistic gymnastics for ages 6-12. Progressive skill development with safe technique and structured training.',
  },
  {
    path: '/artistic-gymnastics-13-18',
    title: 'Artistic Gymnastics Ages 13-18 | Vortex Gymnastics',
    description:
      'Artistic gymnastics for ages 13-18. Advanced training, strength, and performance readiness for committed athletes.',
  },
  {
    path: '/campaigns/artistic-gymnastics-early',
    title: 'Artistic Gymnastics Early Development | Vortex Gymnastics',
    description:
      'Early artistic gymnastics for ages 2-5. Foundational movement, confidence, and skill-building in a safe, playful environment.',
  },
  {
    path: '/campaigns/artistic-gymnastics-6-12',
    title: 'Artistic Gymnastics Ages 6-12 | Vortex Gymnastics',
    description:
      'Artistic gymnastics for ages 6-12. Progressive skill development with safe technique and structured training.',
  },
  {
    path: '/campaigns/artistic-gymnastics-13-18',
    title: 'Artistic Gymnastics Ages 13-18 | Vortex Gymnastics',
    description:
      'Artistic gymnastics for ages 13-18. Advanced training, strength, and performance readiness for committed athletes.',
  },
  {
    path: '/read-board',
    title: 'Classes & Events | Vortex Gymnastics',
    description:
      'View upcoming gymnastics classes, camps, and events at Vortex Gymnastics. Same schedule hub as Vortex Athletics.',
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
    canonical: buildCanonical(GYMNASTICS_ORIGIN, route.path),
    robots: options?.robots,
  }
}
