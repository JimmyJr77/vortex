import { buildCanonical, HUB_ORIGIN, type SeoMeta } from '../utils/seo'

export interface HubRouteSeo {
  path: string
  title: string
  description: string
  priority?: number
}

export const HUB_HOME_SEO: HubRouteSeo = {
  path: '/',
  title: 'Vortex Athletics - Transform Youth Athletes Into Champions',
  description:
    'Vortex Athletics is a premier youth athletic development center. Gymnastics, ninja, strength, athleticism programs, classes, events, and development-first coaching.',
  priority: 1.0,
}

export const HUB_ROUTES: HubRouteSeo[] = [
  HUB_HOME_SEO,
  {
    path: '/gymnastics',
    title: 'Gymnastics Programs | Vortex Athletics',
    description:
      'Progressive gymnastics training for all ages at Vortex Athletics. Build strength, flexibility, discipline, and confidence through expert coaching.',
    priority: 0.8,
  },
  {
    path: '/ninja',
    title: 'Vortex Ninja Programs | Vortex Athletics',
    description:
      'Ninja obstacle training at Vortex Athletics. Develop agility, grip strength, coordination, and problem-solving through dynamic movement.',
    priority: 0.8,
  },
  {
    path: '/strength-conditioning',
    title: 'Fit & Flip Strength & Conditioning | Vortex Athletics',
    description:
      'Fit & Flip strength and conditioning at Vortex Athletics. Functional fitness, mobility, and acrobatics for adults and athletes.',
    priority: 0.8,
  },
  {
    path: '/athleticism-accelerator',
    title: 'Athleticism Accelerator | Vortex Athletics',
    description:
      'The Athleticism Accelerator builds complete athletes across eight tenets of athleticism: speed, power, coordination, and injury-resistant movement.',
    priority: 0.8,
  },
  {
    path: '/value',
    title: 'Our Value & Philosophy | Vortex Athletics',
    description:
      'Learn what makes Vortex Athletics different: development-first training, expert coaches, and programs built for long-term athlete success.',
    priority: 0.7,
  },
  {
    path: '/read-board',
    title: 'Classes & Events | Vortex Athletics',
    description:
      'View upcoming classes, camps, and events at Vortex Athletics. Stay up to date on schedules and opportunities for your athlete.',
    priority: 0.8,
  },
  {
    path: '/artistic-gymnastics-early',
    title: 'Artistic Gymnastics Early Development | Vortex Athletics',
    description:
      'Early artistic gymnastics at Vortex Athletics. Foundational movement, confidence, and skill-building for young athletes.',
    priority: 0.7,
  },
  {
    path: '/artistic-gymnastics-6-12',
    title: 'Artistic Gymnastics Ages 6-12 | Vortex Athletics',
    description:
      'Artistic gymnastics for ages 6-12 at Vortex Athletics. Progressive skill development with safe technique and structured training.',
    priority: 0.7,
  },
  {
    path: '/artistic-gymnastics-13-18',
    title: 'Artistic Gymnastics Ages 13-18 | Vortex Athletics',
    description:
      'Artistic gymnastics for ages 13-18 at Vortex Athletics. Advanced training, strength, and performance readiness for committed athletes.',
    priority: 0.7,
  },
  {
    path: '/campaigns/artistic-gymnastics-early',
    title: 'Artistic Gymnastics Early Development | Vortex Athletics',
    description:
      'Early artistic gymnastics at Vortex Athletics. Foundational movement, confidence, and skill-building for young athletes.',
    priority: 0.6,
  },
  {
    path: '/campaigns/artistic-gymnastics-6-12',
    title: 'Artistic Gymnastics Ages 6-12 | Vortex Athletics',
    description:
      'Artistic gymnastics for ages 6-12 at Vortex Athletics. Progressive skill development with safe technique and structured training.',
    priority: 0.6,
  },
  {
    path: '/campaigns/artistic-gymnastics-13-18',
    title: 'Artistic Gymnastics Ages 13-18 | Vortex Athletics',
    description:
      'Artistic gymnastics for ages 13-18 at Vortex Athletics. Advanced training, strength, and performance readiness for committed athletes.',
    priority: 0.6,
  },
]

const routeMap = new Map(HUB_ROUTES.map((route) => [route.path, route]))

export const getHubSeoForPath = (pathname: string): SeoMeta => {
  const route = routeMap.get(pathname) ?? HUB_HOME_SEO
  return {
    title: route.title,
    description: route.description,
    canonical: buildCanonical(HUB_ORIGIN, route.path),
  }
}

export const HUB_SITEMAP_PATHS = HUB_ROUTES.map((route) => route.path)
