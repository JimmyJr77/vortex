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
